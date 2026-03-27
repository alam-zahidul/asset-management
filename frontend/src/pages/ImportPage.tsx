import React, { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { assetApi } from '../services/assets';
import toast from 'react-hot-toast';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import { formatDate } from '../utils/helpers';

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const { data: importLogs, refetch: refetchLogs } = useQuery({
    queryKey: ['import-logs'],
    queryFn: () => assetApi.getImportLogs(1, 10),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => assetApi.import(file),
    onSuccess: (result) => {
      toast.success(`Import complete: ${result.successfulRows}/${result.totalRows} rows`);
      setFile(null);
      refetchLogs();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Import failed');
    },
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && isValidFile(droppedFile)) {
      setFile(droppedFile);
    } else {
      toast.error('Please upload a CSV or Excel file');
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && isValidFile(selectedFile)) {
      setFile(selectedFile);
    } else if (selectedFile) {
      toast.error('Please upload a CSV or Excel file');
    }
  };

  const isValidFile = (file: File): boolean => {
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    return validExtensions.includes(ext) && file.size <= 50 * 1024 * 1024;
  };

  const handleUpload = () => {
    if (file) {
      importMutation.mutate(file);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Import Assets</h1>

      {/* Upload Zone */}
      <div
        className={`bg-white rounded-xl shadow-sm border-2 border-dashed p-12 text-center mb-8 transition-colors ${
          dragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
        }`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        {file ? (
          <div>
            <FileSpreadsheet className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="font-medium text-gray-900">{file.name}</p>
            <p className="text-sm text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
            <div className="flex justify-center gap-3 mt-6">
              <button
                onClick={() => setFile(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Remove
              </button>
              <button
                onClick={handleUpload}
                disabled={importMutation.isPending}
                className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {importMutation.isPending ? 'Importing...' : 'Upload & Import'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="font-medium text-gray-900">Drop your file here or click to browse</p>
            <p className="text-sm text-gray-500 mt-1">Supports CSV and Excel files (max 50MB)</p>
            <label className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer">
              <Upload className="h-4 w-4" />
              Select File
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      {/* Import result */}
      {importMutation.data && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h3 className="font-semibold text-gray-900 mb-4">Import Result</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold">{importMutation.data.totalRows}</p>
              <p className="text-sm text-gray-500">Total Rows</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{importMutation.data.successfulRows}</p>
              <p className="text-sm text-gray-500">Successful</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{importMutation.data.failedRows}</p>
              <p className="text-sm text-gray-500">Failed</p>
            </div>
          </div>

          {importMutation.data.errors?.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-red-600 mb-2">Errors:</h4>
              <div className="max-h-48 overflow-auto space-y-1">
                {importMutation.data.errors.map((err: { row: number; errors: string[] }, i: number) => (
                  <div key={i} className="text-sm text-red-600 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    Row {err.row}: {err.errors.join('; ')}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import History */}
      {importLogs?.data?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Import History</h3>
          <div className="space-y-3">
            {importLogs.data.map((log: { id: string; file_name: string; status: string; total_rows: number; successful_rows: number; failed_rows: number; created_at: string; imported_by_name: string }) => (
              <div key={log.id} className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{log.file_name}</p>
                    <p className="text-xs text-gray-500">{log.imported_by_name} · {formatDate(log.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-600">{log.successful_rows} ok</span>
                  {log.failed_rows > 0 && <span className="text-red-600">{log.failed_rows} failed</span>}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    log.status === 'completed' ? 'bg-green-100 text-green-700' :
                    log.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>{log.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
