'use client';

import { useState, useEffect, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import { UploadCloud, Download, Combine, X, FileText, Trash2, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { createModuleLogger } from '@/lib/logger';
import { usePdfCart } from '@/context/PdfCartContext';

// Initialize logger for this module
const log = createModuleLogger('merge-pdf');

export default function MergePdfPage() {
  const { cartItems, isLoaded, removeFromCart, clearCart } = usePdfCart();
  const [mergeFiles, setMergeFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mergedFileName, setMergedFileName] = useState('merged_document.pdf');

  // Use ref to track loaded cart item IDs to prevent duplicates (persists through StrictMode)
  const loadedCartIdsRef = useRef(new Set());

  // Sync cart items to merge files - handles both initial load and new additions
  useEffect(() => {
    if (!isLoaded) return;

    // Find cart items that haven't been added yet
    const newItems = cartItems.filter(item => !loadedCartIdsRef.current.has(item.id));

    if (newItems.length > 0) {
      // Mark these IDs as loaded
      newItems.forEach(item => loadedCartIdsRef.current.add(item.id));

      const newFilesForMerge = newItems.map(item => ({
        id: item.id,
        name: item.name,
        size: item.size,
        source: item.source,
        isCartItem: true,
        data: item.data
      }));

      setMergeFiles(prev => [...prev, ...newFilesForMerge]);
    }
  }, [isLoaded, cartItems]);

  const handleFileUpload = async (files) => {
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
    setIsUploading(true);

    // Read file metadata with a small delay to show loading state
    const newFiles = await Promise.all(validFiles.map(async (file, index) => {
      // Verify PDF is readable
      try {
        const arrayBuffer = await file.arrayBuffer();
        await PDFDocument.load(arrayBuffer);
      } catch (err) {
        log.warn({ fileName: file.name, error: err.message }, 'PDF file validation failed');
        throw new Error(`Invalid PDF file: ${file.name}`);
      }

      return {
        id: Date.now() + index,
        file: file,
        name: file.name,
        size: (file.size / 1024).toFixed(2) + ' KB',
        source: 'manual-upload',
        isCartItem: false
      };
    })).catch(err => {
      setError(err.message);
      setIsUploading(false);
      return null;
    });

    if (newFiles) {
      setMergeFiles(prev => [...prev, ...newFiles]);
    }
    setIsUploading(false);
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
    const fileToRemove = mergeFiles.find(f => f.id === id);
    log.info({ fileName: fileToRemove?.name, fileId: id, isCartItem }, 'Removing file');

    // Remove from merge files list
    setMergeFiles(prev => prev.filter(file => file.id !== id));

    // Remove from tracked IDs ref
    loadedCartIdsRef.current.delete(id);

    // Also remove from cart if it's a cart item
    if (isCartItem) {
      removeFromCart(id);
    }
  };

  const clearAllFiles = () => {
    log.info({ fileCount: mergeFiles.length }, 'Clearing all files');
    clearCart();
    setMergeFiles([]);
    loadedCartIdsRef.current.clear();
    setError('');
  };

  const mergePDFs = async () => {
    log.info({
      totalCount: mergeFiles.length,
      outputFileName: mergedFileName
    }, 'PDF merge started');

    if (mergeFiles.length < 2) {
      log.warn({ fileCount: mergeFiles.length }, 'Not enough files to merge');
      setError('Please add at least 2 PDF files to merge');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Create a new PDF document
      const mergedPdf = await PDFDocument.create();
      log.debug('Created new PDF document');

      // Process each PDF file
      let totalPages = 0;
      for (const pdfFile of mergeFiles) {
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

  // Move file up/down in the unified list
  const moveFile = (index, direction) => {
    const newFiles = [...mergeFiles];
    const newIndex = direction === 'up' ? index - 1 : index + 1;

    if (newIndex < 0 || newIndex >= mergeFiles.length) return;

    [newFiles[index], newFiles[newIndex]] = [newFiles[newIndex], newFiles[index]];
    setMergeFiles(newFiles);
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
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Merge PDF Files
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
                onDrop={!isUploading ? handleDrop : undefined}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all mb-4 ${
                  isUploading
                    ? 'border-purple-500 bg-purple-50'
                    : isDragging
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-300 hover:border-purple-400'
                }`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-16 h-16 mx-auto mb-4 text-purple-500 animate-spin" />
                    <p className="text-purple-600 font-medium mb-2">
                      Processing PDF files...
                    </p>
                    <p className="text-gray-500 text-sm">
                      Please wait while we validate your files
                    </p>
                  </>
                ) : (
                  <>
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
                        disabled={isUploading}
                      />
                      <span className="bg-purple-600 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-purple-700 transition-colors inline-block">
                        Browse Files
                      </span>
                    </label>
                  </>
                )}
              </div>

              {mergeFiles.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">
                      {mergeFiles.length} file{mergeFiles.length !== 1 ? 's' : ''} ready
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
                    disabled={mergeFiles.length < 2 || isProcessing}
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

              {mergeFiles.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 mb-3">
                    Reorder files using the arrows. Files will be merged in this order.
                  </p>
                  {mergeFiles.map((file, index) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-purple-300 transition-colors"
                    >
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => moveFile(index, 'up')}
                          disabled={index === 0}
                          className="text-gray-400 hover:text-purple-600 disabled:opacity-30 p-0.5"
                          aria-label="Move up"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveFile(index, 'down')}
                          disabled={index === mergeFiles.length - 1}
                          className="text-gray-400 hover:text-purple-600 disabled:opacity-30 p-0.5"
                          aria-label="Move down"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-gray-800 truncate">
                            {index + 1}. {file.name}
                          </p>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getSourceColor(file.source)}`}>
                            {getSourceLabel(file.source)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{file.size}</p>
                      </div>

                      <button
                        onClick={() => removeFile(file.id, file.isCartItem)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        aria-label="Remove file"
                      >
                        <X className="w-5 h-5 text-red-600" />
                      </button>
                    </div>
                  ))}
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
