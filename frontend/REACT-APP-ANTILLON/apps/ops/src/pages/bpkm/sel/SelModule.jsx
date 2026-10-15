// p.ej. src/pages/bpkm/sel/SelModule.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import SelCrear from './SelCrear';
import SelBandeja from './SelBandeja';

export default function SelModule() {
  return (
    <Routes>
      <Route index element={<SelBandeja />} />
      <Route path="crear" element={<SelCrear />} />
      <Route path="mis" element={<SelBandeja />} />
      <Route path="*" element={<Navigate to="mis" replace />} />
    </Routes>
  );
}
