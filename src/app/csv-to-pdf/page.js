'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { UploadCloud, Download, FileText, X, CheckCircle, Image as ImageIcon } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

// Field mapping configuration - defines which CSV fields to include and their display names
const FIELD_MAPPING = [
  { csvField: 'Issue Type', displayName: 'Issue Type' },
  { csvField: 'Issue key', displayName: 'Issue key' },
  { csvField: 'Issue id', displayName: 'Issue id' },
  { csvField: 'Summary', displayName: 'Summary' },
  { csvField: 'Description', displayName: 'Description' },
  { csvField: 'Assignee', displayName: 'Assignee' },
  { csvField: 'Reporter', displayName: 'Reporter' },
  { csvField: 'Priority', displayName: 'Priority' },
  { csvField: 'Status', displayName: 'Status' },
  { csvField: 'Created', displayName: 'Created' },
  { csvField: 'Updated', displayName: 'Updated' },
  { csvField: 'Custom field (Plan Start Date)', displayName: 'Plan Start Date' },
  { csvField: 'Custom field (Plan End Date)', displayName: 'Plan End Date' },
  { csvField: 'Custom field (Plan Duration (Decimal Hours))', displayName: 'Plan Duration' },
  { csvField: 'Custom field (Actual Start.)', displayName: 'Actual Start.' },
  { csvField: 'Custom field (Actual End.)', displayName: 'Actual End.' },
  { csvField: 'Custom field (Actual Duration (Decimal Hours))', displayName: 'Actual Duration' },
  { csvField: 'Project key', displayName: 'Project key' },
  { csvField: 'Project name', displayName: 'Project name' },
  { csvField: 'Project type', displayName: 'Project type' },
  { csvField: 'Project lead', displayName: 'Project lead' }
];

// Helper function to map CSV data to defined fields
const mapCsvDataToFields = (csvData, fieldMapping) => {
  if (!csvData || csvData.length === 0) {
    return { headers: [], body: [] };
  }

  const csvHeaders = csvData[0];

  // Create a map of lowercase headers to their indices for case-insensitive matching
  const headerIndexMap = {};
  csvHeaders.forEach((header, index) => {
    headerIndexMap[header.toString().toLowerCase().trim()] = index;
  });

  // Build column mapping: for each field in FIELD_MAPPING, find its index in CSV
  const columnMapping = fieldMapping.map(field => {
    const csvFieldLower = field.csvField.toLowerCase().trim();
    const index = headerIndexMap[csvFieldLower];
    return {
      displayName: field.displayName,
      csvIndex: index !== undefined ? index : null
    };
  });

  // Build mapped headers
  const mappedHeaders = columnMapping.map(col => col.displayName);

  // Build mapped body rows
  const mappedBody = csvData.slice(1).map(row => {
    return columnMapping.map(col => {
      if (col.csvIndex !== null && row[col.csvIndex] !== undefined) {
        return row[col.csvIndex];
      }
      return ''; // Empty string for missing fields
    });
  });

  return { headers: mappedHeaders, body: mappedBody };
};

export default function CsvToPdfPage() {
  const [csvData, setCsvData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [signatureImage, setSignatureImage] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [pdfConfig, setPdfConfig] = useState({
    orientation: 'landscape',
    fontSize: 3,
    title: '',
    employeeName: '',
    teamLeader: ''
  });

  const handleFileUpload = (file) => {
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setError('Please upload a valid CSV file');
      return;
    }

    setError('');
    setFileName(file.name);

    Papa.parse(file, {
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          setCsvData(results.data);

          // Since we always map to 21 columns, always use landscape orientation
          setPdfConfig(prev => ({ ...prev, orientation: 'landscape' }));
        } else {
          setError('CSV file is empty');
        }
      },
      error: (error) => {
        setError('Error parsing CSV file: ' + error.message);
      }
    });
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (PNG, JPG, etc.)');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setSignaturePreview(event.target.result);
      setSignatureImage(event.target.result);
    };
    reader.readAsDataURL(file);
    setError('');
  };

  const removeSignature = () => {
    setSignatureImage(null);
    setSignaturePreview(null);
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
    const file = e.dataTransfer.files[0];
    handleFileUpload(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    handleFileUpload(file);
  };

  const generatePDF = () => {
    if (!csvData || csvData.length === 0) return;

    const doc = new jsPDF({
      orientation: pdfConfig.orientation,
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = pdfConfig.orientation === 'landscape' ? 297 : 210;
    const pageHeight = pdfConfig.orientation === 'landscape' ? 210 : 297;

    // Start table at the very top of the page
    let yPosition = 5;

    // Filter out completely empty rows
    const filteredData = csvData.filter(row =>
      row.some(cell => cell && cell.toString().trim() !== '')
    );

    if (filteredData.length === 0) {
      setError('No valid data to export');
      return;
    }

    // Map CSV data to defined fields
    const { headers: filteredHeaders, body } = mapCsvDataToFields(filteredData, FIELD_MAPPING);

    // Table configuration - More vertical spacing and better readability
    const tableStartY = yPosition;

    doc.autoTable({
      head: [filteredHeaders],
      body: body,
      startY: tableStartY,
      styles: {
        fontSize: pdfConfig.fontSize,
        cellPadding: 1,
        overflow: 'linebreak',
        cellWidth: 'auto',
        minCellHeight: 3.5,
        halign: 'left',
        lineWidth: 0.03,
        lineColor: [200, 200, 200],
        valign: 'top'
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        cellPadding: 1,
        fontSize: pdfConfig.fontSize,
        minCellHeight: 4.5
      },
      bodyStyles: {
        valign: 'top',
        cellPadding: 1,
        minCellHeight: 3.5
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { left: 2, right: 2, top: 3, bottom: 40 },
      tableWidth: 'auto',
      theme: 'grid',
      didDrawPage: (data) => {
        // Footer with page numbers
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `Page ${data.pageNumber} of ${pageCount}`,
          pageWidth - 20,
          pageHeight - 2
        );
      }
    });

    // Get final Y position after table
    const finalY = doc.lastAutoTable.finalY;

    // Signature Section - Fixed at bottom of page
    // Only add signatures on the last page
    const totalPages = doc.internal.getNumberOfPages();
    doc.setPage(totalPages);

    // Position signature section at the bottom of the page
    const signatureY = pageHeight - 35;

    // Calculate centered positions with increased spacing
    const pageCenter = pageWidth / 2;
    const signatureSpacing = 60; // Increased spacing between signatures
    const signatureWidth = 50;

    const leftSignatureCenter = pageCenter - signatureSpacing;
    const rightSignatureCenter = pageCenter + signatureSpacing;

    const leftSignatureX = leftSignatureCenter - (signatureWidth / 2);
    const rightSignatureX = rightSignatureCenter - (signatureWidth / 2);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // Employee Signature - Center aligned with increased spacing
    doc.text('Karyawan', leftSignatureCenter, signatureY, { align: 'center' });
    
    // Add signature image if available - positioned with more space from text
    if (signatureImage) {
      const imgWidth = 30;
      const imgHeight = 10;
      const imgX = leftSignatureCenter - (imgWidth / 2);
      const imgY = signatureY + 4; // Increased from +2 to +4 for more space
      
      try {
        doc.addImage(signatureImage, 'PNG', imgX, imgY, imgWidth, imgHeight);
      } catch (error) {
        console.error('Error adding signature image:', error);
      }
    }
    
    // Signature line - positioned lower to accommodate signature image
    doc.line(leftSignatureX, signatureY + 16, leftSignatureX + signatureWidth, signatureY + 16); // Changed from +12 to +16
    doc.text(pdfConfig.employeeName || '_________________', leftSignatureCenter, signatureY + 21, { align: 'center' }); // Changed from +17 to +21
    doc.setFontSize(8);

    // Team Leader Signature - Center aligned with same spacing
    doc.setFontSize(10);
    doc.text('Team Leader', rightSignatureCenter, signatureY, { align: 'center' });
    doc.line(rightSignatureX, signatureY + 16, rightSignatureX + signatureWidth, signatureY + 16); // Changed from +12 to +16
    doc.text(pdfConfig.teamLeader || '_________________', rightSignatureCenter, signatureY + 21, { align: 'center' }); // Changed from +17 to +21
    doc.setFontSize(8);

    // Use PDF Filename field, fallback to CSV name
    const pdfFileName = pdfConfig.title
      ? `${pdfConfig.title}.pdf`
      : fileName.replace('.csv', '.pdf') || 'timesheet.pdf';
    doc.save(pdfFileName);
  };

  const clearFile = () => {
    setCsvData(null);
    setFileName('');
    setError('');
    setSignatureImage(null);
    setSignaturePreview(null);
    setPdfConfig({
      orientation: 'landscape',
      fontSize: 3,
      title: '',
      employeeName: '',
      teamLeader: ''
    });
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Jira CSV to PDF Converter
            </h1>
            <p className="text-gray-600">
              Upload your Jira CSV file and convert it to a beautifully formatted PDF
            </p>
          </header>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Upload Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-blue-600" />
                Upload CSV File
              </h2>

              {!csvData ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-blue-400'
                  }`}
                >
                  <UploadCloud
                    className={`w-16 h-16 mx-auto mb-4 ${
                      isDragging ? 'text-blue-500' : 'text-gray-400'
                    }`}
                  />
                  <p className="text-gray-600 mb-2">
                    Drag and drop your CSV file here
                  </p>
                  <p className="text-gray-500 text-sm mb-4">or</p>
                  <label className="inline-block">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                    <span className="bg-blue-600 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors inline-block">
                      Browse Files
                    </span>
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium text-gray-800">{fileName}</p>
                        <p className="text-sm text-gray-600">
                          {csvData.length} rows × {FIELD_MAPPING.length} columns (mapped)
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={clearFile}
                      className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                      aria-label="Remove file"
                    >
                      <X className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-800">PDF Settings</h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        PDF Filename
                      </label>
                      <input
                        type="text"
                        value={pdfConfig.title}
                        onChange={(e) =>
                          setPdfConfig({ ...pdfConfig, title: e.target.value })
                        }
                        placeholder="e.g., Absen Jira November"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                      />
                      <p className="text-xs text-gray-500 mt-1">This will be used as the PDF filename</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nama Karyawan (Employee Name)
                      </label>
                      <input
                        type="text"
                        value={pdfConfig.employeeName}
                        onChange={(e) =>
                          setPdfConfig({ ...pdfConfig, employeeName: e.target.value })
                        }
                        placeholder="Enter employee name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tanda Tangan Karyawan (Employee Signature)
                      </label>
                      {!signaturePreview ? (
                        <label className="cursor-pointer">
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-all text-center">
                            <ImageIcon className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm text-gray-600 mb-1">Upload signature image</p>
                            <p className="text-xs text-gray-500">PNG, JPG (Recommended: transparent PNG)</p>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleSignatureUpload}
                            className="hidden"
                          />
                        </label>
                      ) : (
                        <div className="relative border border-gray-300 rounded-lg p-3 bg-gray-50">
                          <div className="flex items-center gap-3">
                            <img 
                              src={signaturePreview} 
                              alt="Signature preview" 
                              className="h-16 w-auto object-contain bg-white border border-gray-200 rounded px-2"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-700">Signature uploaded</p>
                              <p className="text-xs text-gray-500">Will appear above employee name</p>
                            </div>
                            <button
                              onClick={removeSignature}
                              className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                              aria-label="Remove signature"
                            >
                              <X className="w-5 h-5 text-red-600" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Team Leader
                      </label>
                      <input
                        type="text"
                        value={pdfConfig.teamLeader}
                        onChange={(e) =>
                          setPdfConfig({ ...pdfConfig, teamLeader: e.target.value })
                        }
                        placeholder="Enter team leader name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Orientation
                      </label>
                      <select
                        value={pdfConfig.orientation}
                        onChange={(e) =>
                          setPdfConfig({ ...pdfConfig, orientation: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      >
                        <option value="landscape">Landscape (Recommended for wide tables)</option>
                        <option value="portrait">Portrait</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Font Size
                      </label>
                      <input
                        type="number"
                        min="3"
                        max="14"
                        value={pdfConfig.fontSize}
                        onChange={(e) =>
                          setPdfConfig({
                            ...pdfConfig,
                            fontSize: parseInt(e.target.value)
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      />
                      <p className="text-xs text-gray-500 mt-1">Default is 3pt to match BATM template. Increase to 4-5pt if text is too small.</p>
                    </div>

                    <button
                      onClick={generatePDF}
                      className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-medium"
                    >
                      <Download className="w-5 h-5" />
                      Download PDF
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
            </div>

            {/* Preview Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Data Preview
              </h2>

              {csvData && csvData.length > 0 ? (() => {
                // Apply field mapping to preview data
                const { headers: mappedHeaders, body: mappedBody } = mapCsvDataToFields(csvData, FIELD_MAPPING);
                const previewRows = mappedBody.slice(0, 50);

                return (
                  <div className="overflow-auto max-h-[600px] border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          {mappedHeaders.map((header, index) => (
                            <th
                              key={index}
                              className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap"
                            >
                              {header || `Column ${index + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {previewRows.map((row, rowIndex) => (
                          <tr
                            key={rowIndex}
                            className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                          >
                            {row.map((cell, cellIndex) => (
                              <td
                                key={cellIndex}
                                className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap"
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {mappedBody.length > 50 && (
                      <div className="p-3 bg-gray-50 text-center text-sm text-gray-600">
                        Showing first 50 rows of {mappedBody.length} data rows
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div className="text-center py-16 text-gray-400">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No data to preview</p>
                  <p className="text-sm mt-2">Upload a CSV file to see the preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}