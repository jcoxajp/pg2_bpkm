import { Routes, Route } from 'react-router-dom';
import GerenciaBandeja from './GerenciaBandeja';
import GerenciaDetalle from './GerenciaDetalle';

export default function GerenciaModule() {
  return (
    <Routes>
      <Route index element={<GerenciaBandeja />} />
      <Route path=":id_bpkm" element={<GerenciaDetalle />} />
    </Routes>
  );
}
