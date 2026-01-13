'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { UploadCloud, Download, CalendarClock, X, CheckCircle, User } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

export default function GreatDayToPdfPage() {
  const [attendanceData, setAttendanceData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [pdfConfig, setPdfConfig] = useState({
    companyName: '',
    period: ''
  });

  const handleFileUpload = (file) => {
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setError('Please upload a valid CSV file from Great Day');
      return;
    }

    setError('');
    setFileName(file.name);

    Papa.parse(file, {
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          setAttendanceData(results.data);
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
    if (!attendanceData || attendanceData.length === 0) return;

    const doc = new jsPDF('landscape');
    
    // Add header with company name and period
    doc.setFontSize(18);
    doc.text(pdfConfig.companyName || 'Attendance Report', 14, 15);
    
    if (pdfConfig.period) {
      doc.setFontSize(12);
      doc.text(`Period: ${pdfConfig.period}`, 14, 23);
    }

    const filteredData = attendanceData.filter(row => 
      row.some(cell => cell && cell.toString().trim() !== '')
    );

    if (filteredData.length === 0) {
      setError('No valid data to export');
      return;
    }

    const headers = filteredData[0];
    const body = filteredData.slice(1);

    doc.autoTable({
      head: [headers],
      body: body,
      startY: pdfConfig.period ? 30 : 22,
      styles: {
        fontSize: 9,
        cellPadding: 2
      },
      headStyles: {
        fillColor: [34, 197, 94],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251]
      },
      columnStyles: {
        0: { cellWidth: 'auto' }
      }
    });

    const pdfFileName = fileName.replace('.csv', '_attendance.pdf') || 'greatday_attendance.pdf';
    doc.save(pdfFileName);
  };

  const clearFile = () => {
    setAttendanceData(null);
    setFileName('');
    setError('');
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Great Day to PDF Converter
            </h1>
            <p className="text-gray-600">
              Convert Great Day attendance exports to formatted PDF reports
            </p>
          </header>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Upload Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-green-600" />
                Upload Great Day Export
              </h2>

              {!attendanceData ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                    isDragging
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-300 hover:border-green-400'
                  }`}
                >
                  <CalendarClock
                    className={`w-16 h-16 mx-auto mb-4 ${
                      isDragging ? 'text-green-500' : 'text-gray-400'
                    }`}
                  />
                  <p className="text-gray-600 mb-2">
                    Drag and drop Great Day CSV export here
                  </p>
                  <p className="text-gray-500 text-sm mb-4">or</p>
                  <label className="inline-block">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                    <span className="bg-green-600 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-green-700 transition-colors inline-block">
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
                          {attendanceData.length} rows loaded
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
                    <h3 className="font-semibold text-gray-800">Report Settings</h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={pdfConfig.companyName}
                        onChange={(e) =>
                          setPdfConfig({ ...pdfConfig, companyName: e.target.value })
                        }
                        placeholder="Enter company name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                        placeholder="e.g., January 2024"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>

                    <button
                      onClick={generatePDF}
                      className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-medium"
                    >
                      <Download className="w-5 h-5" />
                      Download Attendance PDF
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
                <User className="w-5 h-5 text-green-600" />
                Attendance Preview
              </h2>

              {attendanceData && attendanceData.length > 0 ? (
                <div className="overflow-auto max-h-[600px] border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-green-50 sticky top-0">
                      <tr>
                        {attendanceData[0].map((header, index) => (
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
                      {attendanceData.slice(1, 50).map((row, rowIndex) => (
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
                  {attendanceData.length > 51 && (
                    <div className="p-3 bg-gray-50 text-center text-sm text-gray-600">
                      Showing first 50 rows of {attendanceData.length - 1} data rows
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-400">
                  <CalendarClock className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No attendance data to preview</p>
                  <p className="text-sm mt-2">Upload a Great Day export to see the data</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}