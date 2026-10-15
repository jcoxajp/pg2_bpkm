import { Routes, Route } from 'react-router-dom';
import RrhhBandeja from './RrhhBandeja';
import RrhhDetalle from './RrhhDetalle';

export default function RrhhModule() {
  return (
    <Routes>
      <Route index element={<RrhhBandeja />} />
      <Route path=":id_bpkm" element={<RrhhDetalle />} />
    </Routes>
  );
}
