import { Routes, Route, Navigate } from 'react-router-dom';
import RutasBandeja from './RutasBandeja';
import RutaCrear from './RutaCrear';
import RutaDetalle from './RutaDetalle';

export default function RutasModule() {
  return (
    <Routes>
      <Route index element={<RutasBandeja />} />
      <Route path="crear" element={<RutaCrear />} />
      <Route path=":id" element={<RutaDetalle />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}
