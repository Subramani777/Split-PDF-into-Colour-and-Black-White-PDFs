const { PDFDocument } = PDFLib;

let file;
let fileArrayBuffer;
let filename;

var colorPages = [];
var grayPages = [];

document.addEventListener('DOMContentLoaded', function() {
  const uploadBox = document.getElementById('uploadBox');
  const fileInput = document.getElementById('fileInput');
  const splitButton = document.getElementById('Split');
  const regenerateButton = document.getElementById('Regenerate');

  if (uploadBox) {
    uploadBox.addEventListener('dragover', function(event) {
      event.preventDefault();
      event.stopPropagation();
      this.classList.add('dragover');
    });
    
    uploadBox.addEventListener('dragleave', function(event) {
      event.preventDefault();
      event.stopPropagation();
      this.classList.remove('dragover');
    });
    
    uploadBox.addEventListener('drop', function(event) {
      event.preventDefault();
      event.stopPropagation();
      this.classList.remove('dragover');
      const files = event.dataTransfer.files;
      handleFiles(files);
    });

    uploadBox.addEventListener('click', function() {
      if (fileInput) {
        fileInput.click();
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', function(event) {
      const files = event.target.files;
      handleFiles(files);
    });
  }

  if (splitButton) {
    splitButton.addEventListener('click', async function() {
      if (!file) {
        alert('Please upload a file first.');
        return;
      }
        // Show the loading modal
        document.getElementById('loadingModal').style.display = 'block';

        try {
            await getColorAndGrayPages(file);
            await splitPdf(fileArrayBuffer, colorPages, grayPages);
        } catch (error) {
            console.error('Error during PDF processing:', error);
            alert('An error occurred while processing the PDF. Please try again.');
        } finally {
            // Hide the loading modal
            document.getElementById('loadingModal').style.display = 'none';
        }

    });
  }
  if (regenerateButton) {
    regenerateButton.addEventListener('click', async function() {

      ifValid = transfer();
      if (ifValid) {
        await splitPdf(fileArrayBuffer, colorPages, grayPages);
      }
      
    });
  } 
});

async function handleFiles(files) {
  if (files.length > 0) {
    file = files[0];
    filename = file.name;
    if (file.type === 'application/pdf') {
      document.getElementById('uploadBox').textContent = file.name;

      const reader = new FileReader();
      reader.onload = function(event) {
        fileArrayBuffer = event.target.result; // Store the ArrayBuffer
      };
      reader.readAsArrayBuffer(file); // Read the file, not fileArrayBuffer
    } else {
      alert('Please upload a PDF file.');
    }
  }
}

async function splitPdf(arrayBuffer, colorPages, grayPages) {
  if (colorPages.length === 0) {
    alert("There are no color pages in the PDF. Please upload a correct PDF.");
    return;
  }
  if (grayPages.length === 0) {
    alert("There are no grey pages in the PDF. Please upload a correct PDF.");
    return; // Exit the function if both arrays are empty
  }
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    const subDocumentColor = await PDFDocument.create();
    for (let i = 0; i < colorPages.length; i++) {
        const pageIndex = colorPages[i] - 1; // Convert to zero-based index
        const [copiedPage] = await subDocumentColor.copyPages(pdfDoc, [pageIndex]);
        subDocumentColor.addPage(copiedPage);
    }

    const subDocumentGray = await PDFDocument.create();
    for (let i = 0; i < grayPages.length; i++) {
        const pageIndex = grayPages[i] - 1; // Convert to zero-based index
        const [copiedPage] = await subDocumentGray.copyPages(pdfDoc, [pageIndex]);
        subDocumentGray.addPage(copiedPage);
    }

    const colorPdf = await subDocumentColor.save();
    savePdfBytesToFile(`${filename}_color.pdf`, colorPdf);
    const grayPdf = await subDocumentGray.save();
    savePdfBytesToFile(`${filename}_gray.pdf`, grayPdf);
}

function savePdfBytesToFile(fileName, pdfBytes) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    saveAs(blob, fileName);
}

async function getColorAndGrayPages(file) {
  // Reset colorPages and grayPages
  colorPages.length = 0;
  grayPages.length = 0;
  const pdfData = await file.arrayBuffer(); // This should work now
  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  const numPages = pdf.numPages;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport: viewport }).promise;

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const isColor = analyzeImageData(imageData.data);
      
      if (isColor) {
          colorPages.push(pageNum);
      } else {
          grayPages.push(pageNum);
      }
  }
}

function analyzeImageData(data) {
  let hasColor = false;
  for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Check if the pixel is not grayscale
      if (r !== g || g !== b) {
          hasColor = true;
          break;
      }
  }
  return hasColor;
}

function parseIndices(input) {
  const indices = new Set();
  const parts = input.split(',');

  parts.forEach(part => {
      if (part.includes('-')) {
          const [start, end] = part.split('-').map(Number);
          for (let i = start; i <= end; i++) {
              indices.add(i);
          }
      } else {
          indices.add(Number(part));
      }
  });
  
  return Array.from(indices);
}

function transfer() {
  // Check if a file has been uploaded
  if (!file) {
      alert('Please upload a PDF file.');
      return false; // Exit the function if no file is selected
  }  
  // Get the arrays from the input fields
  let array1 = colorPages;
  let array2 = grayPages;
  
  // Get the selected direction
  const direction = document.getElementById('MovePageFrom').value;
  
  // Get the indices to transfer
  const pagesInput = document.getElementById('pageNumber').value;
  const indicesPages = parseIndices(pagesInput).filter(index => index >= 0);
  const indices = indicesPages.map(num => num - 1);

  // Check if the input is empty
  if (!pagesInput.trim()) {
    alert("Please enter page numbers.");
    return false;
  }

  const isValid = indices.every(index => index >= 0);

  if (!isValid) {
      alert("Please enter values in terms of 1,2,3.. or 1-3,4-6..");
      return false; // Return false if any value is invalid
  }

  if (colorPages.length === 0 && grayPages.length === 0) {
    alert("Please perform the split operation first.");
    return false; // Exit the function if both arrays are empty
  }

  // Validate indices
  let valid = true;
  if (direction === '1to2') {
      valid = indices.every(index => index < array1.length);
  } else {
      valid = indices.every(index => index < array2.length);
  }

  if (!valid) {
      alert("Please mention proper pages that exist in the selected pdf.");
      return false;
  }

  let transferredItems = [];

  if (direction === '1to2') {
      // Transfer from Array 1 to Array 2
      transferredItems = indices.map(index => array1[index]).filter(item => item !== undefined);
      array2 = array2.concat(transferredItems);
      array1 = array1.filter((_, index) => !indices.includes(index));
  } else {
      // Transfer from Array 2 to Array 1
      transferredItems = indices.map(index => array2[index]).filter(item => item !== undefined);
      array1 = array1.concat(transferredItems);
      array2 = array2.filter((_, index) => !indices.includes(index));
  }
  colorPages = array1.sort((a, b) => a - b);
  grayPages = array2.sort((a, b) => a - b);
  return true;
}