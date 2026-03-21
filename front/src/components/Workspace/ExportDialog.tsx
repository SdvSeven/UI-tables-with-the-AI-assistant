import React, { useState } from 'react';

interface ExportDialogProps {
  onExport: (format: string) => void;
  onClose: () => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ onExport, onClose }) => {
  const [format, setFormat] = useState('csv');

  const handleExport = () => {
    onExport(format);
    onClose();
  };

  return (
    <div className="export-dialog">
      <select value={format} onChange={(e) => setFormat(e.target.value)}>
        <option value="csv">CSV</option>
        <option value="json">JSON</option>
        <option value="xlsx">Excel (XLSX)</option>
      </select>
      <button onClick={handleExport}>Экспорт</button>
      <button onClick={onClose}>Отмена</button>
    </div>
  );
};

export default ExportDialog;