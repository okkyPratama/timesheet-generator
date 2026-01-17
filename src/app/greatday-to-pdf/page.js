'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { UploadCloud, Download, FileSpreadsheet, X, CheckCircle, User, Image as ImageIcon } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

// Field mapping configuration - defines which Excel fields to include and their display names
const FIELD_MAPPING = [
  { excelField: 'No.', displayName: 'No.' },
  { excelField: 'Emp No.', displayName: 'Emp No.' },
  { excelField: 'Employee', displayName: 'Employee' },
  { excelField: 'Date', displayName: 'Date' },
  { excelField: 'Shift Name', displayName: 'Shift Name' },
  { excelField: 'Shift In', displayName: 'Shift In' },
  { excelField: 'Shift Out', displayName: 'Shift Out' },
  { excelField: 'Actual In', displayName: 'Actual In' },
  { excelField: 'Actual Out', displayName: 'Actual Out' },
  { excelField: 'Remark', displayName: 'Remark' }
];

// Helper function to map Excel data to defined fields
const mapExcelDataToFields = (excelData, fieldMapping) => {
  if (!excelData || excelData.length < 3) {
    return { headers: [], body: [] };
  }

  // Excel headers are in row index 2 (third row)
  const excelHeaders = excelData[2] || [];

  // Create a map of lowercase headers to their indices for case-insensitive matching
  const headerIndexMap = {};
  excelHeaders.forEach((header, index) => {
    if (header) {
      headerIndexMap[header.toString().toLowerCase().trim()] = index;
    }
  });

  // Build column mapping: for each field in FIELD_MAPPING, find its index in Excel
  const columnMapping = fieldMapping.map(field => {
    const excelFieldLower = field.excelField.toLowerCase().trim();
    const index = headerIndexMap[excelFieldLower];
    return {
      displayName: field.displayName,
      excelIndex: index !== undefined ? index : null
    };
  });

  // Build mapped headers
  const mappedHeaders = columnMapping.map(col => col.displayName);

  // Build mapped body rows (data starts from row index 3)
  const mappedBody = excelData.slice(3).map(row => {
    return columnMapping.map(col => {
      if (col.excelIndex !== null && row[col.excelIndex] !== undefined) {
        let value = row[col.excelIndex];

        // Special handling for Remark field - filter out numeric patterns
        if (col.displayName === 'Remark') {
          const remarkValue = value || '';
          const isNumericPattern = /^\d+\s*\(\d+:\d+\)$/.test(remarkValue.toString().trim()) || /^\d+$/.test(remarkValue.toString().trim());
          return isNumericPattern ? '' : remarkValue;
        }

        return value;
      }
      return '';
    });
  });

  return { headers: mappedHeaders, body: mappedBody };
};

export default function GreatDayToBpsPdfPage() {
  const [attendanceData, setAttendanceData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [employeeStats, setEmployeeStats] = useState(null);
  const [signatureImage, setSignatureImage] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [pdfConfig, setPdfConfig] = useState({
    fileName: '',
    employeeName: '',
    checkedBy: '',
    approvedBy: '',
    justifikasi: ''
  });

  const handleFileUpload = (file) => {
    if (!file) return;

    const validExtensions = ['.xlsx', '.xls'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      setError('Please upload a valid Excel file (.xlsx or .xls) from Great Day');
      return;
    }

    setError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData && jsonData.length > 3) {
          setAttendanceData(jsonData);
          calculateStats(jsonData);
          extractEmployeeData(jsonData);
        } else {
          setError('Excel file appears to be empty or invalid');
        }
      } catch (err) {
        setError('Error reading Excel file: ' + err.message);
      }
    };
    
    reader.onerror = () => setError('Error reading file');
    reader.readAsArrayBuffer(file);
  };

  const extractEmployeeData = (data) => {
    if (data.length > 3) {
      const firstDataRow = data[3];
      setPdfConfig(prev => ({
        ...prev,
        employeeName: firstDataRow[2] || ''
      }));
    }
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

  const calculateStats = (data) => {
    if (!data || data.length < 4) return;
    
    const dataRows = data.slice(3);
    const employees = new Set();
    const dates = new Set();
    
    dataRows.forEach(row => {
      if (row[1]) employees.add(row[1]);
      if (row[5]) dates.add(row[5]);
    });
    
    setEmployeeStats({
      totalRecords: dataRows.length,
      uniqueEmployees: employees.size,
      dateRange: dates.size
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
    if (!attendanceData || attendanceData.length === 0) {
      setError('No data to export');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Title
    doc.setFontSize(7);
    doc.setFont('times', 'bold');
    doc.text('Attendance Report', pageWidth / 2, 14, { align: 'center' });

    // Prepare table data using field mapping
    const { headers, body: dataRows } = mapExcelDataToFields(attendanceData, FIELD_MAPPING);

    // Main table - adjusted for portrait orientation
    doc.autoTable({
      head: [headers],
      body: dataRows,
      startY: 16,
      margin: { left: 5, right: 5 },
      styles: {
        font: 'times',
        fontSize: 6.5,
        cellPadding: 0.6,
        overflow: 'linebreak',
        cellWidth: 'wrap',
        lineWidth: 0.2,
        lineColor: [0, 0, 0],
        valign: 'middle',
        minCellHeight: 4
      },
      headStyles: {
        font: 'times',
        fillColor: [192, 192, 192],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineWidth: 0.2,
        lineColor: [0, 0, 0],
        halign: 'center',
        valign: 'middle',
        cellPadding: 0.8,
        minCellHeight: 4
      },
      bodyStyles: {
        font: 'times',
        lineWidth: 0.2,
        lineColor: [0, 0, 0],
        minCellHeight: 3.5
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 16 },
        2: { cellWidth: 32 },
        3: { cellWidth: 18 },
        4: { cellWidth: 32 },
        5: { cellWidth: 11, halign: 'center' },
        6: { cellWidth: 11, halign: 'center' },
        7: { cellWidth: 11, halign: 'center' },
        8: { cellWidth: 11, halign: 'center' },
        9: { cellWidth: 40 }
      },
      theme: 'grid'
    });

    let finalY = doc.lastAutoTable.finalY + 3;
    const marginLeft = 5; // Match table margin
    const tableWidth = 190; // Total width of table columns (8+16+32+18+32+11+11+11+11+40)

    // Justifikasi section - bordered box with label inside
    const justBoxHeight = 55; // Height to match ~16 rows in Excel template
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.rect(marginLeft, finalY, tableWidth, justBoxHeight);

    // "Justifikasi :" label inside box at top-left corner (touching the line)
    doc.setFontSize(8);
    doc.setFont('times', 'normal');
    doc.text('Justifikasi :', marginLeft + 0.5, finalY + 2.5);

    // Add justifikasi text if provided (below the label)
    if (pdfConfig.justifikasi && pdfConfig.justifikasi.trim() !== '') {
      doc.setFontSize(7);
      doc.setFont('times', 'normal');
      const justLines = doc.splitTextToSize(pdfConfig.justifikasi, tableWidth - 6);
      doc.text(justLines, marginLeft + 2, finalY + 8);
    }

    finalY += justBoxHeight + 3;

    // Declaration text in bordered box - manually split into 3 lines to match template
    doc.setFontSize(7);
    doc.setFont('times', 'italic');
    const declarationLines = [
      'Dengan ini saya menyatakan dengan sebenarnya bahwa seluruh data dan informasi yang saya sampaikan dalam dokumen ini adalah benar dan',
      'dapat dipertanggung jawabkan. Apabila ditemukan data yang tidak valid atau palsu, saya bersedia menerima sanksi sesuai dengan peraturan',
      'yang berlaku.'
    ];

    // Draw declaration box
    const declBoxHeight = 12;
    doc.setLineWidth(0.2);
    doc.rect(marginLeft, finalY, tableWidth, declBoxHeight);

    // Add text inside the box (center aligned, 3 lines)
    const boxCenterX = marginLeft + tableWidth / 2;
    declarationLines.forEach((line, index) => {
      doc.text(line, boxCenterX, finalY + 3 + (index * 3), { align: 'center' });
    });

    finalY += declBoxHeight + 3;

    // Four-column signature section with borders
    const sigBoxHeight = 25; // Increased height
    const dateColWidth = 25; // Very narrow column for date (tight padding)
    const sigColWidth = (tableWidth - dateColWidth) / 3; // Remaining width split into 3

    // Column 1 - Print date only (center aligned)
    doc.setLineWidth(0.2);
    doc.rect(marginLeft, finalY, dateColWidth, sigBoxHeight);

    const now = new Date();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayName = days[now.getDay()];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const day = String(now.getDate()).padStart(2, '0');
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const dateColCenter = marginLeft + dateColWidth / 2;
    doc.setFontSize(7);
    doc.setFont('times', 'normal');
    doc.text('Tanggal Cetak :', dateColCenter, finalY + 6, { align: 'center' });
    doc.text(`${dayName}, ${day}-${month}-`, dateColCenter, finalY + 11, { align: 'center' });
    doc.text(`${year} ${hours}:${minutes}:${seconds}`, dateColCenter, finalY + 16, { align: 'center' });

    // Column 2 - Employee signature (center aligned)
    const col2X = marginLeft + dateColWidth;
    const col2Center = col2X + sigColWidth / 2;
    doc.setLineWidth(0.2);
    doc.rect(col2X, finalY, sigColWidth, sigBoxHeight);

    doc.setFontSize(7.5);
    doc.setFont('times', 'normal');
    doc.text('Tanda Tangan Pegawai,', col2Center, finalY + 3, { align: 'center' });

    // Add signature image if available (centered)
    if (signatureImage) {
      const imgWidth = 25;
      const imgHeight = 10;
      const imgX = col2Center - imgWidth / 2;
      const imgY = finalY + 5;

      try {
        doc.addImage(signatureImage, 'PNG', imgX, imgY, imgWidth, imgHeight);
      } catch (error) {
        console.error('Error adding signature image:', error);
      }
    }

    doc.setFont('times', 'normal');
    doc.text(`( ${pdfConfig.employeeName || ''} )`, col2Center, finalY + 23, { align: 'center' });

    // Column 3 - Checked by (center aligned)
    const col3X = col2X + sigColWidth;
    const col3Center = col3X + sigColWidth / 2;
    doc.setLineWidth(0.2);
    doc.rect(col3X, finalY, sigColWidth, sigBoxHeight);
    doc.setFontSize(7.5);
    doc.setFont('times', 'normal');
    doc.text('Diperiksa Oleh :', col3Center, finalY + 3, { align: 'center' });
    doc.text(`( ${pdfConfig.checkedBy || ''} )`, col3Center, finalY + 23, { align: 'center' });

    // Column 4 - Approved by (center aligned)
    const col4X = col3X + sigColWidth;
    const col4Center = col4X + sigColWidth / 2;
    doc.setLineWidth(0.2);
    doc.rect(col4X, finalY, sigColWidth, sigBoxHeight);
    doc.setFontSize(7.5);
    doc.setFont('times', 'normal');
    doc.text('Disetujui Oleh :', col4Center, finalY + 3, { align: 'center' });
    doc.text(`( ${pdfConfig.approvedBy || ''} )`, col4Center, finalY + 23, { align: 'center' });

    // Use custom filename if provided, otherwise use original filename
    const outputFileName = pdfConfig.fileName
      ? `${pdfConfig.fileName}.pdf`
      : fileName.replace(/\.(xlsx|xls)$/i, '_BPS_Format.pdf');
    doc.save(outputFileName);
  };

  const clearFile = () => {
    setAttendanceData(null);
    setFileName('');
    setError('');
    setEmployeeStats(null);
    setSignatureImage(null);
    setSignaturePreview(null);
    setPdfConfig({ fileName: '', employeeName: '', checkedBy: '', approvedBy: '', justifikasi: '' });
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Great Day to BPS PDF Converter
            </h1>
            <p className="text-gray-600">
              Convert Great Day attendance exports to BPS format PDF with signature section
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
                    isDragging ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-400'
                  }`}
                >
                  <FileSpreadsheet className={`w-16 h-16 mx-auto mb-4 ${isDragging ? 'text-green-500' : 'text-gray-400'}`} />
                  <p className="text-gray-600 mb-2">Drag and drop Great Day Excel export here</p>
                  <p className="text-gray-500 text-sm mb-4">or</p>
                  <label className="inline-block">
                    <input type="file" accept=".xlsx,.xls" onChange={handleFileInput} className="hidden" />
                    <span className="bg-green-600 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-green-700 transition-colors inline-block">
                      Browse Files
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-4">Accepts: .xlsx, .xls files</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium text-gray-800">{fileName}</p>
                        {employeeStats && (
                          <p className="text-sm text-gray-600">
                            {employeeStats.totalRecords} records • {employeeStats.uniqueEmployees} employees
                          </p>
                        )}
                      </div>
                    </div>
                    <button onClick={clearFile} className="p-2 hover:bg-green-100 rounded-lg transition-colors">
                      <X className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold text-gray-800">PDF Configuration</h3>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">PDF Filename</label>
                      <input
                        type="text"
                        value={pdfConfig.fileName}
                        onChange={(e) => setPdfConfig({ ...pdfConfig, fileName: e.target.value })}
                        placeholder="e.g., Attendance Report December"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-gray-900"
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave empty to use original filename</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Employee Name</label>
                      <input
                        type="text"
                        value={pdfConfig.employeeName}
                        onChange={(e) => setPdfConfig({ ...pdfConfig, employeeName: e.target.value })}
                        placeholder="Auto-detected from file"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Employee Signature (Tanda Tangan Karyawan)</label>
                      {!signaturePreview ? (
                        <label className="cursor-pointer">
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-green-400 transition-all text-center">
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Checked By (Diperiksa Oleh)</label>
                      <input
                        type="text"
                        value={pdfConfig.checkedBy}
                        onChange={(e) => setPdfConfig({ ...pdfConfig, checkedBy: e.target.value })}
                        placeholder="e.g., ATHIANA NURUL"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Approved By (Disetujui Oleh)</label>
                      <input
                        type="text"
                        value={pdfConfig.approvedBy}
                        onChange={(e) => setPdfConfig({ ...pdfConfig, approvedBy: e.target.value })}
                        placeholder="e.g., ASWIN SWASTIKA"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Justifikasi</label>
                      <textarea
                        value={pdfConfig.justifikasi}
                        onChange={(e) => setPdfConfig({ ...pdfConfig, justifikasi: e.target.value })}
                        placeholder="Enter justification text (optional)"
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-gray-900 resize-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">This text will appear in the Justifikasi box</p>
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
                <User className="w-5 h-5 text-green-600" />
                Data Preview
              </h2>

              {attendanceData && attendanceData.length > 0 ? (() => {
                // Apply field mapping to preview data
                const { headers: mappedHeaders, body: mappedBody } = mapExcelDataToFields(attendanceData, FIELD_MAPPING);
                const previewRows = mappedBody.slice(0, 20);

                return (
                  <div className="overflow-auto max-h-[600px] border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-green-50 sticky top-0">
                        <tr>
                          {mappedHeaders.map((header, index) => (
                            <th key={index} className="px-2 py-2 text-left text-xs font-medium text-gray-700">
                              {header || `Col ${index + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {previewRows.map((row, rowIndex) => (
                          <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex} className="px-2 py-2 whitespace-nowrap text-gray-900">
                                {cell || ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {mappedBody.length > 20 && (
                      <div className="p-3 bg-gray-50 text-center text-xs text-gray-600">
                        Showing first 20 data rows of {mappedBody.length} total
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div className="text-center py-16 text-gray-400">
                  <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 opacity-50" />
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