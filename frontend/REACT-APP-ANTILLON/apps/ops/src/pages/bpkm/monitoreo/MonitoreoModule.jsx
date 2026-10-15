import { Routes, Route, Navigate } from 'react-router-dom';
import MonitoreoBandeja from './MonitoreoBandeja';

export default function MonitoreoModule() {
  return (
    <Routes>
      <Route index element={<MonitoreoBandeja />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}
