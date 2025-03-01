import { Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import MappingPage from './components/MappingPage';
import Poly from './components/Poly';
import OCR1 from './components/OCR';
import OCR from './components/recognition';
import DigitizationStudio from './components/DigitizationStudio';

const App = () => {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/studio" element={<DigitizationStudio />} />
        <Route path="/ocr" element={<DigitizationStudio />} />
        <Route path="/mapping" element={<MappingPage />} />
        <Route path="/poly" element={<Poly />} />
        <Route path="/test" element={<OCR />} />
        <Route path="/single-ocr" element={<OCR1 />} />
      </Routes>
    </>
  );
};

export default App;