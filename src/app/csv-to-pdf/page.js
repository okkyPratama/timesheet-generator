'use client';

import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { UploadCloud, Download, FileText, X, CheckCircle, Image as ImageIcon, ShoppingCart, Square, CheckSquare, MinusSquare, Loader2 } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { createModuleLogger } from '@/lib/logger';
import { useUserData } from '@/context/UserDataContext';
import { usePdfCart } from '@/context/PdfCartContext';

// Initialize logger for this module
const log = createModuleLogger('csv-to-pdf');

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
  const { userData, updateField, isLoaded } = useUserData();
  const { addToCart, cartCount } = usePdfCart();
  const [addedToCart, setAddedToCart] = useState(false);
  const [csvData, setCsvData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [signatureImage, setSignatureImage] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [pdfConfig, setPdfConfig] = useState({
    orientation: 'portrait',
    fontSize: 3,
    title: '',
    employeeName: '',
    teamLeader: '',
    departmentHead: ''
  });
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [isUploading, setIsUploading] = useState(false);

  // Load shared user data when context is ready
  useEffect(() => {
    if (isLoaded) {
      log.info('Loading shared user data into form');
      setPdfConfig(prev => ({
        ...prev,
        employeeName: userData.employeeName || prev.employeeName,
        teamLeader: userData.teamLeader || prev.teamLeader
      }));
      if (userData.signatureImage) {
        setSignatureImage(userData.signatureImage);
        setSignaturePreview(userData.signatureImage);
      }
    }
  }, [isLoaded, userData.employeeName, userData.teamLeader, userData.signatureImage]);

  // Update shared state when employee name changes
  const handleEmployeeNameChange = (value) => {
    setPdfConfig(prev => ({ ...prev, employeeName: value }));
    updateField('employeeName', value);
  };

  // Update shared state when team leader changes
  const handleTeamLeaderChange = (value) => {
    setPdfConfig(prev => ({ ...prev, teamLeader: value }));
    updateField('teamLeader', value);
  };

  const handleFileUpload = (file) => {
    if (!file) {
      log.debug('No file provided to handleFileUpload');
      return;
    }

    log.info({ fileName: file.name, fileSize: file.size, fileType: file.type }, 'File upload initiated');

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      log.warn({ fileName: file.name, fileType: file.type }, 'Invalid file type uploaded');
      setError('Please upload a valid CSV file');
      return;
    }

    setError('');
    setFileName(file.name);
    setIsUploading(true);

    Papa.parse(file, {
      complete: (results) => {
        setIsUploading(false);
        if (results.data && results.data.length > 0) {
          log.info({
            rowCount: results.data.length,
            columnCount: results.data[0]?.length || 0,
            fileName: file.name
          }, 'CSV file parsed successfully');
          setCsvData(results.data);

          // Initialize all data rows as selected (excluding header row)
          const { body } = mapCsvDataToFields(results.data, FIELD_MAPPING);
          const allRowIndices = new Set(body.map((_, index) => index));
          setSelectedRows(allRowIndices);

          // Default to portrait orientation to match standard timesheet format
          setPdfConfig(prev => ({ ...prev, orientation: 'portrait' }));
        } else {
          log.warn({ fileName: file.name }, 'CSV file is empty');
          setError('CSV file is empty');
        }
      },
      error: (error) => {
        setIsUploading(false);
        log.error({ error: error.message, fileName: file.name }, 'Error parsing CSV file');
        setError('Error parsing CSV file: ' + error.message);
      }
    });
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files[0];
    if (!file) {
      log.debug('No signature file provided');
      return;
    }

    log.info({ fileName: file.name, fileSize: file.size, fileType: file.type }, 'Signature upload initiated');

    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      log.warn({ fileName: file.name, fileType: file.type }, 'Invalid signature file type');
      setError('Please upload a valid image file (PNG, JPG, etc.)');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      log.info({ fileName: file.name }, 'Signature image loaded successfully');
      setSignaturePreview(event.target.result);
      setSignatureImage(event.target.result);
      // Save to shared state
      updateField('signatureImage', event.target.result);
    };
    reader.onerror = (error) => {
      log.error({ error: error, fileName: file.name }, 'Error reading signature file');
    };
    reader.readAsDataURL(file);
    setError('');
  };

  const removeSignature = () => {
    setSignatureImage(null);
    setSignaturePreview(null);
    // Clear from shared state
    updateField('signatureImage', null);
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
    log.info({ config: pdfConfig }, 'PDF generation started');

    if (!csvData || csvData.length === 0) {
      log.warn('No CSV data available for PDF generation');
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: pdfConfig.orientation,
        unit: 'mm',
        format: 'letter'
      });

      // Letter size: 215.9mm x 279.4mm (8.5" x 11")
      const pageWidth = pdfConfig.orientation === 'landscape' ? 279.4 : 215.9;
      const pageHeight = pdfConfig.orientation === 'landscape' ? 215.9 : 279.4;

      log.debug({ pageWidth, pageHeight, orientation: pdfConfig.orientation }, 'PDF document created');

      // Start table at the very top of the page
      let yPosition = 5;

      // Filter out completely empty rows
      const filteredData = csvData.filter(row =>
        row.some(cell => cell && cell.toString().trim() !== '')
      );

      log.debug({
        originalRows: csvData.length,
        filteredRows: filteredData.length
      }, 'Data filtered for empty rows');

      if (filteredData.length === 0) {
        log.warn('No valid data to export after filtering');
        setError('No valid data to export');
        return;
      }

      // Map CSV data to defined fields
      const { headers: filteredHeaders, body: allRows } = mapCsvDataToFields(filteredData, FIELD_MAPPING);

      // Filter to only include selected rows
      const body = allRows.filter((_, index) => selectedRows.has(index));

      if (body.length === 0) {
        log.warn('No rows selected for PDF generation');
        setError('Please select at least one row to include in the PDF');
        return;
      }

      log.debug({
        headerCount: filteredHeaders.length,
        totalRows: allRows.length,
        selectedRows: body.length
      }, 'Data mapped and filtered to selected rows');

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
    });

    // Get final Y position after table
    const finalY = doc.lastAutoTable.finalY;

    // Signature Section - Fixed at bottom of page
    // Only add signatures on the last page
    const totalPages = doc.internal.getNumberOfPages();
    doc.setPage(totalPages);

    // Position signature section at the bottom of the page
    const signatureY = pageHeight - 35;

    // Calculate positions for 3 signature blocks (Karyawan, Team Leader, Department Head)
    const marginX = 10;
    const usableWidth = pageWidth - (marginX * 2);
    const signatureWidth = 45;
    const signatureSpacing = usableWidth / 3;

    // Center positions for each signature block
    const leftSignatureCenter = marginX + (signatureSpacing / 2);
    const middleSignatureCenter = marginX + signatureSpacing + (signatureSpacing / 2);
    const rightSignatureCenter = marginX + (signatureSpacing * 2) + (signatureSpacing / 2);

    const leftSignatureX = leftSignatureCenter - (signatureWidth / 2);
    const middleSignatureX = middleSignatureCenter - (signatureWidth / 2);
    const rightSignatureX = rightSignatureCenter - (signatureWidth / 2);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // Employee Signature (Left)
    doc.text('Karyawan', leftSignatureCenter, signatureY, { align: 'center' });

    // Add signature image if available
    if (signatureImage) {
      log.debug('Adding signature image to PDF');
      const imgWidth = 30;
      const imgHeight = 10;
      const imgX = leftSignatureCenter - (imgWidth / 2);
      const imgY = signatureY + 4;

      try {
        doc.addImage(signatureImage, 'PNG', imgX, imgY, imgWidth, imgHeight);
        log.info('Signature image added successfully');
      } catch (imgError) {
        log.error({ error: imgError.message }, 'Error adding signature image');
      }
    }

    // Signature line and name
    doc.line(leftSignatureX, signatureY + 16, leftSignatureX + signatureWidth, signatureY + 16);
    doc.text(pdfConfig.employeeName || '_________________', leftSignatureCenter, signatureY + 21, { align: 'center' });

    // Team Leader Signature (Middle)
    doc.text('Team Leader', middleSignatureCenter, signatureY, { align: 'center' });
    doc.line(middleSignatureX, signatureY + 16, middleSignatureX + signatureWidth, signatureY + 16);
    doc.text(pdfConfig.teamLeader || '_________________', middleSignatureCenter, signatureY + 21, { align: 'center' });

    // Department Head Signature (Right)
    doc.text('Department Head', rightSignatureCenter, signatureY, { align: 'center' });
    doc.line(rightSignatureX, signatureY + 16, rightSignatureX + signatureWidth, signatureY + 16);
    doc.text(pdfConfig.departmentHead || '_________________', rightSignatureCenter, signatureY + 21, { align: 'center' });

    doc.setFontSize(8);

    // Use PDF Filename field, fallback to CSV name
    const pdfFileName = pdfConfig.title
      ? `${pdfConfig.title}.pdf`
      : fileName.replace('.csv', '.pdf') || 'timesheet.pdf';

      log.info({
        pdfFileName,
        totalPages: doc.internal.getNumberOfPages(),
        dataRows: body.length
      }, 'PDF generated successfully');

      // Get PDF as base64 for cart storage
      const pdfBase64 = doc.output('datauristring');
      const pdfBlob = doc.output('blob');

      // Add to cart
      addToCart({
        name: pdfFileName,
        data: pdfBase64,
        size: (pdfBlob.size / 1024).toFixed(2) + ' KB',
        source: 'csv-to-pdf'
      });

      // Show added to cart feedback
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 3000);

      // Also download the file
      doc.save(pdfFileName);
    } catch (error) {
      log.error({ error: error.message, stack: error.stack }, 'Error generating PDF');
      setError('Error generating PDF: ' + error.message);
    }
  };

  const clearFile = () => {
    log.info('Clearing file and resetting form');
    setCsvData(null);
    setFileName('');
    setError('');
    setSignatureImage(null);
    setSignaturePreview(null);
    setSelectedRows(new Set());
    setPdfConfig({
      orientation: 'portrait',
      fontSize: 3,
      title: '',
      employeeName: '',
      teamLeader: '',
      departmentHead: ''
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

          {/* Upload Section - Always visible */}
          {!csvData ? (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-blue-600" />
                Upload CSV File
              </h2>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={!isUploading ? handleDrop : undefined}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                  isUploading
                    ? 'border-blue-500 bg-blue-50'
                    : isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-blue-400'
                }`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-16 h-16 mx-auto mb-4 text-blue-500 animate-spin" />
                    <p className="text-blue-600 font-medium mb-2">
                      Processing CSV file...
                    </p>
                    <p className="text-gray-500 text-sm">
                      Please wait while we parse your data
                    </p>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* File Info */}
              <div className="bg-white rounded-lg shadow p-6">
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
              </div>

              {/* Data Preview Section - Shown first when file is uploaded */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Data Preview
                </h2>

                {(() => {
                  const { headers: mappedHeaders, body: mappedBody } = mapCsvDataToFields(csvData, FIELD_MAPPING);
                  const previewRows = mappedBody.slice(0, 50);
                  const allSelected = mappedBody.length > 0 && selectedRows.size === mappedBody.length;
                  const someSelected = selectedRows.size > 0 && selectedRows.size < mappedBody.length;

                  const toggleRow = (rowIndex) => {
                    setSelectedRows(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(rowIndex)) {
                        newSet.delete(rowIndex);
                      } else {
                        newSet.add(rowIndex);
                      }
                      return newSet;
                    });
                  };

                  const toggleAll = () => {
                    if (allSelected) {
                      setSelectedRows(new Set());
                    } else {
                      setSelectedRows(new Set(mappedBody.map((_, index) => index)));
                    }
                  };

                  return (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm text-gray-600">
                          {selectedRows.size} of {mappedBody.length} rows selected for PDF
                        </p>
                        <button
                          onClick={toggleAll}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {allSelected ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                      <div className="overflow-auto max-h-[400px] border border-gray-200 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-3 text-center w-10">
                                <button
                                  onClick={toggleAll}
                                  className="text-gray-600 hover:text-blue-600"
                                  title={allSelected ? 'Deselect all' : 'Select all'}
                                >
                                  {allSelected ? (
                                    <CheckSquare className="w-5 h-5 text-blue-600" />
                                  ) : someSelected ? (
                                    <MinusSquare className="w-5 h-5 text-blue-600" />
                                  ) : (
                                    <Square className="w-5 h-5" />
                                  )}
                                </button>
                              </th>
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
                                className={`${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${
                                  !selectedRows.has(rowIndex) ? 'opacity-50' : ''
                                } hover:bg-blue-50 cursor-pointer`}
                                onClick={() => toggleRow(rowIndex)}
                              >
                                <td className="px-3 py-3 text-center">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleRow(rowIndex);
                                    }}
                                    className="text-gray-600 hover:text-blue-600"
                                  >
                                    {selectedRows.has(rowIndex) ? (
                                      <CheckSquare className="w-5 h-5 text-blue-600" />
                                    ) : (
                                      <Square className="w-5 h-5" />
                                    )}
                                  </button>
                                </td>
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
                            Showing first 50 rows of {mappedBody.length} data rows (selection applies to all rows)
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* PDF Settings Section - Shown below preview */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Download className="w-5 h-5 text-blue-600" />
                  PDF Settings
                </h2>

                <div className="space-y-4">
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
                      onChange={(e) => handleEmployeeNameChange(e.target.value)}
                      placeholder="Enter employee name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                    />
                    <p className="text-xs text-gray-500 mt-1">Auto-saved across all pages</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tanda Tangan Karyawan (Employee Signature)
                    </label>
                    {!signaturePreview ? (
                      <label className="cursor-pointer">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-all text-center">
                          <ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
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
                            className="h-12 w-auto object-contain bg-white border border-gray-200 rounded px-2"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700">Signature uploaded</p>
                            <p className="text-xs text-gray-500">Auto-saved across all pages</p>
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
                      onChange={(e) => handleTeamLeaderChange(e.target.value)}
                      placeholder="Enter team leader name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                    />
                    <p className="text-xs text-gray-500 mt-1">Auto-saved across all pages</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Department Head
                    </label>
                    <input
                      type="text"
                      value={pdfConfig.departmentHead}
                      onChange={(e) =>
                        setPdfConfig({ ...pdfConfig, departmentHead: e.target.value })
                      }
                      placeholder="Enter department head name"
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
                      <option value="portrait">Portrait (Recommended)</option>
                      <option value="landscape">Landscape (for wide tables)</option>
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
                    <p className="text-xs text-gray-500 mt-1">Default is 3pt. Increase to 4-5pt if text is too small.</p>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    onClick={generatePDF}
                    className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-medium"
                  >
                    <Download className="w-5 h-5" />
                    Download PDF & Add to Merge
                  </button>

                  {addedToCart && (
                    <div className="flex items-center justify-center gap-2 p-3 mt-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700">
                      <ShoppingCart className="w-4 h-4" />
                      <span className="text-sm">Added to Merge PDF!</span>
                    </div>
                  )}

                  {error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-700 text-sm">{error}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}