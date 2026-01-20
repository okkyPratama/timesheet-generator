'use client';

import { useState, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import { UploadCloud, Download, Combine, X, FileText, GripVertical, ShoppingCart, Trash2 } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { createModuleLogger } from '@/lib/logger';
import { usePdfCart } from '@/context/PdfCartContext';

// Initialize logger for this module
const log = createModuleLogger('merge-pdf');

export default function MergePdfPage() {
  const { cartItems, cartCount, isLoaded, removeFromCart, clearCart, moveItem } = usePdfCart();
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [mergedFileName, setMergedFileName] = useState('merged_document.pdf');

  // Combined list of cart items and uploaded files for display
  const allFiles = [
    ...cartItems.map(item => ({
      id: item.id,
      name: item.name,
      size: item.size,
      source: item.source,
      isCartItem: true,
      data: item.data
    })),
    ...uploadedFiles.map(file => ({
      ...file,
      isCartItem: false
    }))
  ];

  const handleFileUpload = (files) => {
    log.info({ fileCount: files.length }, 'PDF files upload initiated');

    const validFiles = Array.from(files).filter(file => file.type === 'application/pdf');

    if (validFiles.length === 0) {
      log.warn({ uploadedCount: files.length }, 'No valid PDF files in upload');
      setError('Please upload valid PDF files');
      return;
    }

    log.info({
      validFiles: validFiles.length,
      invalidFiles: files.length - validFiles.length,
      fileNames: validFiles.map(f => f.name)
    }, 'PDF files validated');

    setError('');
    setUploadedFiles(prev => [...prev, ...validFiles.map((file, index) => ({
      id: Date.now() + index,
      file: file,
      name: file.name,
      size: (file.size / 1024).toFixed(2) + ' KB',
      source: 'manual-upload'
    }))]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleFileInput = (e) => {
    handleFileUpload(e.target.files);
  };

  const removeFile = (id, isCartItem) => {
    if (isCartItem) {
      const fileToRemove = cartItems.find(f => f.id === id);
      log.info({ fileName: fileToRemove?.name, fileId: id, type: 'cart' }, 'Removing cart item');
      removeFromCart(id);
    } else {
      const fileToRemove = uploadedFiles.find(f => f.id === id);
      log.info({ fileName: fileToRemove?.name, fileId: id, type: 'uploaded' }, 'Removing uploaded file');
      setUploadedFiles(prev => prev.filter(file => file.id !== id));
    }
  };

  const clearAllFiles = () => {
    log.info({ cartCount: cartItems.length, uploadedCount: uploadedFiles.length }, 'Clearing all files');
    clearCart();
    setUploadedFiles([]);
    setError('');
  };

  const mergePDFs = async () => {
    log.info({
      cartCount: cartItems.length,
      uploadedCount: uploadedFiles.length,
      totalCount: allFiles.length,
      outputFileName: mergedFileName
    }, 'PDF merge started');

    if (allFiles.length < 2) {
      log.warn({ fileCount: allFiles.length }, 'Not enough files to merge');
      setError('Please add at least 2 PDF files to merge');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Create a new PDF document
      const mergedPdf = await PDFDocument.create();
      log.debug('Created new PDF document');

      // Process each PDF file (both cart items and uploaded files)
      let totalPages = 0;
      for (const pdfFile of allFiles) {
        log.debug({ fileName: pdfFile.name, isCartItem: pdfFile.isCartItem }, 'Processing PDF file');

        let pdfBytes;
        if (pdfFile.isCartItem) {
          // Cart items have base64 data URI
          const base64Data = pdfFile.data.split(',')[1]; // Remove data URI prefix
          pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        } else {
          // Uploaded files have File objects
          pdfBytes = await pdfFile.file.arrayBuffer();
        }

        const pdf = await PDFDocument.load(pdfBytes);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
        totalPages += copiedPages.length;
        log.debug({ fileName: pdfFile.name, pageCount: copiedPages.length }, 'Pages copied from PDF');
      }

      // Save the merged PDF
      const mergedPdfBytes = await mergedPdf.save();

      log.info({
        totalPages,
        fileSize: (mergedPdfBytes.length / 1024).toFixed(2) + ' KB',
        outputFileName: mergedFileName
      }, 'PDF merge completed successfully');

      // Create download link
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = mergedFileName.endsWith('.pdf') ? mergedFileName : `${mergedFileName}.pdf`;
      link.click();

      // Cleanup
      URL.revokeObjectURL(url);

      setError('');
    } catch (err) {
      log.error({ error: err.message, stack: err.stack }, 'Error merging PDFs');
      setError('Error merging PDFs: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Move cart item up/down
  const moveCartItem = (index, direction) => {
    moveItem(index, direction);
  };

  // Move uploaded file up/down
  const moveUploadedFile = (index, direction) => {
    const newFiles = [...uploadedFiles];
    const newIndex = direction === 'up' ? index - 1 : index + 1;

    if (newIndex < 0 || newIndex >= uploadedFiles.length) return;

    [newFiles[index], newFiles[newIndex]] = [newFiles[newIndex], newFiles[index]];
    setUploadedFiles(newFiles);
  };

  // Helper to get source label
  const getSourceLabel = (source) => {
    switch (source) {
      case 'csv-to-pdf': return 'CSV to PDF';
      case 'greatday-to-pdf': return 'Great Day';
      case 'manual-upload': return 'Uploaded';
      default: return 'Unknown';
    }
  };

  // Helper to get source color
  const getSourceColor = (source) => {
    switch (source) {
      case 'csv-to-pdf': return 'bg-blue-100 text-blue-700';
      case 'greatday-to-pdf': return 'bg-green-100 text-green-700';
      case 'manual-upload': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
              Merge PDF Files
              {cartCount > 0 && (
                <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium bg-purple-100 text-purple-700 rounded-full">
                  <ShoppingCart className="w-4 h-4" />
                  {cartCount} in cart
                </span>
              )}
            </h1>
            <p className="text-gray-600">
              Generated PDFs from other pages appear here automatically. You can also upload additional files.
            </p>
          </header>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Upload Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-purple-600" />
                Upload PDF Files
              </h2>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all mb-4 ${
                  isDragging
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-300 hover:border-purple-400'
                }`}
              >
                <Combine
                  className={`w-16 h-16 mx-auto mb-4 ${
                    isDragging ? 'text-purple-500' : 'text-gray-400'
                  }`}
                />
                <p className="text-gray-600 mb-2">
                  Drag and drop PDF files here
                </p>
                <p className="text-gray-500 text-sm mb-4">or</p>
                <label className="inline-block">
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  <span className="bg-purple-600 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-purple-700 transition-colors inline-block">
                    Browse Files
                  </span>
                </label>
              </div>

              {allFiles.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">
                      {allFiles.length} file{allFiles.length !== 1 ? 's' : ''} ready
                      {cartCount > 0 && uploadedFiles.length > 0 && (
                        <span className="text-sm text-gray-500 font-normal ml-2">
                          ({cartCount} from cart, {uploadedFiles.length} uploaded)
                        </span>
                      )}
                    </h3>
                    <button
                      onClick={clearAllFiles}
                      className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear All
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Output File Name
                    </label>
                    <input
                      type="text"
                      value={mergedFileName}
                      onChange={(e) => setMergedFileName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                    />
                  </div>

                  <button
                    onClick={mergePDFs}
                    disabled={allFiles.length < 2 || isProcessing}
                    className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Merging PDFs...
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        Merge & Download PDF
                      </>
                    )}
                  </button>
                </div>
              )}

              {error && (
                <div className={`mt-4 p-4 rounded-lg ${
                  error.includes('Error') 
                    ? 'bg-red-50 border border-red-200' 
                    : 'bg-amber-50 border border-amber-200'
                }`}>
                  <p className={`text-sm ${
                    error.includes('Error') ? 'text-red-700' : 'text-amber-700'
                  }`}>{error}</p>
                </div>
              )}
            </div>

            {/* File List Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                Files to Merge
              </h2>

              {allFiles.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 mb-3">
                    Files will be merged in this order (cart items first, then uploaded files)
                  </p>

                  {/* Cart Items Section */}
                  {cartItems.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4" />
                        From Cart ({cartItems.length})
                      </h3>
                      {cartItems.map((item, index) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200 hover:border-purple-300 transition-colors"
                        >
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => moveCartItem(index, 'up')}
                              disabled={index === 0}
                              className="text-purple-400 hover:text-purple-600 disabled:opacity-30"
                              aria-label="Move up"
                            >
                              <GripVertical className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => moveCartItem(index, 'down')}
                              disabled={index === cartItems.length - 1}
                              className="text-purple-400 hover:text-purple-600 disabled:opacity-30"
                              aria-label="Move down"
                            >
                              <GripVertical className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-gray-800 truncate">
                                {index + 1}. {item.name}
                              </p>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getSourceColor(item.source)}`}>
                                {getSourceLabel(item.source)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{item.size}</p>
                          </div>

                          <button
                            onClick={() => removeFile(item.id, true)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            aria-label="Remove from cart"
                          >
                            <X className="w-5 h-5 text-red-600" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Uploaded Files Section */}
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <UploadCloud className="w-4 h-4" />
                        Uploaded Files ({uploadedFiles.length})
                      </h3>
                      {uploadedFiles.map((file, index) => (
                        <div
                          key={file.id}
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-purple-300 transition-colors"
                        >
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => moveUploadedFile(index, 'up')}
                              disabled={index === 0}
                              className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                              aria-label="Move up"
                            >
                              <GripVertical className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => moveUploadedFile(index, 'down')}
                              disabled={index === uploadedFiles.length - 1}
                              className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                              aria-label="Move down"
                            >
                              <GripVertical className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-gray-800 truncate">
                                {cartItems.length + index + 1}. {file.name}
                              </p>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getSourceColor(file.source)}`}>
                                {getSourceLabel(file.source)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{file.size}</p>
                          </div>

                          <button
                            onClick={() => removeFile(file.id, false)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            aria-label="Remove file"
                          >
                            <X className="w-5 h-5 text-red-600" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-400">
                  <Combine className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No PDF files added</p>
                  <p className="text-sm mt-2">Generate PDFs from CSV to PDF or Great Day to PDF,</p>
                  <p className="text-sm">or upload files manually</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}