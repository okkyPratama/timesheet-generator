'use client';

import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { UploadCloud, Download, Combine, X, FileText, GripVertical } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

export default function MergePdfPage() {
  const [pdfFiles, setPdfFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [mergedFileName, setMergedFileName] = useState('merged_document.pdf');

  const handleFileUpload = (files) => {
    const validFiles = Array.from(files).filter(file => file.type === 'application/pdf');
    
    if (validFiles.length === 0) {
      setError('Please upload valid PDF files');
      return;
    }

    setError('');
    setPdfFiles(prev => [...prev, ...validFiles.map((file, index) => ({
      id: Date.now() + index,
      file: file,
      name: file.name,
      size: (file.size / 1024).toFixed(2) + ' KB'
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

  const removeFile = (id) => {
    setPdfFiles(prev => prev.filter(file => file.id !== id));
  };

  const clearAllFiles = () => {
    setPdfFiles([]);
    setError('');
  };

  const mergePDFs = async () => {
    if (pdfFiles.length < 2) {
      setError('Please upload at least 2 PDF files to merge');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Create a new PDF document
      const mergedPdf = await PDFDocument.create();

      // Process each PDF file
      for (const pdfFile of pdfFiles) {
        const pdfBytes = await pdfFile.file.arrayBuffer();
        const pdf = await PDFDocument.load(pdfBytes);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      // Save the merged PDF
      const mergedPdfBytes = await mergedPdf.save();
      
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
      setError('Error merging PDFs: ' + err.message);
      console.error('Merge error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const moveFile = (index, direction) => {
    const newFiles = [...pdfFiles];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= pdfFiles.length) return;
    
    [newFiles[index], newFiles[newIndex]] = [newFiles[newIndex], newFiles[index]];
    setPdfFiles(newFiles);
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
              Upload multiple PDF files and merge them into a single document
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

              {pdfFiles.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">
                      {pdfFiles.length} file{pdfFiles.length !== 1 ? 's' : ''} selected
                    </h3>
                    <button
                      onClick={clearAllFiles}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
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
                    disabled={pdfFiles.length < 2 || isProcessing}
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

              {pdfFiles.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 mb-3">
                    Drag files to reorder • Files will be merged in this order
                  </p>
                  {pdfFiles.map((file, index) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-purple-300 transition-colors"
                    >
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => moveFile(index, 'up')}
                          disabled={index === 0}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          aria-label="Move up"
                        >
                          <GripVertical className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveFile(index, 'down')}
                          disabled={index === pdfFiles.length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          aria-label="Move down"
                        >
                          <GripVertical className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">
                          {index + 1}. {file.name}
                        </p>
                        <p className="text-sm text-gray-600">{file.size}</p>
                      </div>
                      
                      <button
                        onClick={() => removeFile(file.id)}
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
                  <p className="text-sm mt-2">Upload at least 2 files to merge</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}