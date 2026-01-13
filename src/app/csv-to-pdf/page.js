'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { UploadCloud, Download, FileText, X, CheckCircle } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

export default function CsvToPdfPage() {
  const [csvData, setCsvData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [pdfConfig, setPdfConfig] = useState({
    orientation: 'landscape',
    fontSize: 8,
    title: '',
    employeeName: '',
    teamLeader: '',
    period: ''
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
          
          const columnCount = results.data[0]?.length || 0;
          if (columnCount > 8) {
            setPdfConfig(prev => ({ ...prev, orientation: 'landscape' }));
          }
        } else {
          setError('CSV file is empty');
        }
      },
      error: (error) => {
        setError('Error parsing CSV file: ' + error.message);
      }
    });
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
    let yPosition = 20;

    // Header Section
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    const titleText = pdfConfig.title || 'Timesheet Report';
    const titleWidth = doc.getTextWidth(titleText);
    doc.text(titleText, (pageWidth - titleWidth) / 2, yPosition);
    
    yPosition += 10;

    // Period
    if (pdfConfig.period) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      const periodText = `Period: ${pdfConfig.period}`;
      const periodWidth = doc.getTextWidth(periodText);
      doc.text(periodText, (pageWidth - periodWidth) / 2, yPosition);
      yPosition += 8;
    }

    // Employee Info Section
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const leftMargin = 14;
    
    if (pdfConfig.employeeName) {
      doc.text(`Employee Name: ${pdfConfig.employeeName}`, leftMargin, yPosition);
      yPosition += 6;
    }
    
    if (pdfConfig.teamLeader) {
      doc.text(`Team Leader: ${pdfConfig.teamLeader}`, leftMargin, yPosition);
      yPosition += 6;
    }

    yPosition += 5;

    // Filter out completely empty rows
    const filteredData = csvData.filter(row => 
      row.some(cell => cell && cell.toString().trim() !== '')
    );

    if (filteredData.length === 0) {
      setError('No valid data to export');
      return;
    }

    const headers = filteredData[0];
    const body = filteredData.slice(1);

    // Table
    const tableStartY = yPosition;
    doc.autoTable({
      head: [headers],
      body: body,
      startY: tableStartY,
      styles: {
        fontSize: pdfConfig.fontSize,
        cellPadding: 2,
        overflow: 'linebreak',
        cellWidth: 'wrap',
        minCellHeight: 7,
        halign: 'left'
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle'
      },
      bodyStyles: {
        valign: 'top'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { left: 14, right: 14 },
      tableWidth: 'auto',
      columnStyles: headers.reduce((acc, _, index) => {
        acc[index] = { cellWidth: 'auto' };
        return acc;
      }, {}),
      didDrawPage: (data) => {
        // Footer with page numbers
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `Page ${data.pageNumber} of ${pageCount}`,
          pageWidth - 30,
          pageHeight - 10
        );
      }
    });

    // Get final Y position after table
    const finalY = doc.lastAutoTable.finalY;
    
    // Signature Section
    const signatureY = Math.min(finalY + 20, pageHeight - 50);
    
    // Only add signatures on the last page
    const totalPages = doc.internal.getNumberOfPages();
    doc.setPage(totalPages);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const leftSignatureX = 40;
    const rightSignatureX = pageWidth - 80;
    
    // Employee Signature
    doc.text('Prepared by:', leftSignatureX, signatureY);
    doc.line(leftSignatureX, signatureY + 15, leftSignatureX + 50, signatureY + 15);
    doc.text(pdfConfig.employeeName || '_________________', leftSignatureX, signatureY + 20);
    doc.setFontSize(8);
    doc.text('Employee', leftSignatureX + 10, signatureY + 25);
    
    // Team Leader Signature
    doc.setFontSize(10);
    doc.text('Approved by:', rightSignatureX, signatureY);
    doc.line(rightSignatureX, signatureY + 15, rightSignatureX + 50, signatureY + 15);
    doc.text(pdfConfig.teamLeader || '_________________', rightSignatureX, signatureY + 20);
    doc.setFontSize(8);
    doc.text('Team Leader', rightSignatureX + 8, signatureY + 25);

    const pdfFileName = fileName.replace('.csv', '.pdf') || 'timesheet.pdf';
    doc.save(pdfFileName);
  };

  const clearFile = () => {
    setCsvData(null);
    setFileName('');
    setError('');
    setPdfConfig({
      orientation: 'landscape',
      fontSize: 8,
      title: '',
      employeeName: '',
      teamLeader: '',
      period: ''
    });
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              CSV to PDF Converter
            </h1>
            <p className="text-gray-600">
              Upload your CSV file and convert it to a beautifully formatted PDF
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
                          {csvData.length} rows × {csvData[0]?.length || 0} columns
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
                        Document Title
                      </label>
                      <input
                        type="text"
                        value={pdfConfig.title}
                        onChange={(e) =>
                          setPdfConfig({ ...pdfConfig, title: e.target.value })
                        }
                        placeholder="e.g., Timesheet Report"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Period
                      </label>
                      <input
                        type="text"
                        value={pdfConfig.period}
                        onChange={(e) =>
                          setPdfConfig({ ...pdfConfig, period: e.target.value })
                        }
                        placeholder="e.g., January 2025"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        min="6"
                        max="14"
                        value={pdfConfig.fontSize}
                        onChange={(e) =>
                          setPdfConfig({
                            ...pdfConfig,
                            fontSize: parseInt(e.target.value)
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">Recommended: 7-9 for wide tables</p>
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

              {csvData && csvData.length > 0 ? (
                <div className="overflow-auto max-h-[600px] border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {csvData[0].map((header, index) => (
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
                      {csvData.slice(1, 50).map((row, rowIndex) => (
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
                  {csvData.length > 51 && (
                    <div className="p-3 bg-gray-50 text-center text-sm text-gray-600">
                      Showing first 50 rows of {csvData.length - 1} data rows
                    </div>
                  )}
                </div>
              ) : (
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