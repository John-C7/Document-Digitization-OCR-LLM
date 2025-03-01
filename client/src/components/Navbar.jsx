import { Menu, X, Layers, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

const Navbar = () => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const toggleNavbar = () => {
    setMobileDrawerOpen(!mobileDrawerOpen);
  };

  return (
    <nav className="sticky top-0 z-50 py-3 backdrop-blur-lg border-b border-neutral-800 bg-neutral-950/80">
      <div className="container px-4 mx-auto relative lg:text-sm">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="p-1.5 rounded-lg bg-orange-600/20 text-orange-500 border border-orange-500/30">
              <Layers className="w-5 h-5" />
            </span>
            <span className="text-xl font-bold tracking-tight text-white">
              DocDigitize<span className="text-orange-500">.AI</span>
            </span>
          </Link>
          <ul className="hidden lg:flex ml-14 space-x-8 text-neutral-300 font-medium">
            <li>
              <Link to="/ocr" className="hover:text-orange-400 transition flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                Digitization Studio
              </Link>
            </li>
            <li>
              <Link to="/test" className="hover:text-orange-400 transition">
                Live OCR
              </Link>
            </li>
            <li>
              <Link to="/poly" className="hover:text-orange-400 transition">
                Form Assistant
              </Link>
            </li>
            <li>
              <a href="#features" className="hover:text-orange-400 transition">
                Features
              </a>
            </li>
          </ul>
          <div className="hidden lg:flex items-center space-x-4">
            <Link
              to="/ocr"
              className="py-2 px-4 rounded-lg bg-gradient-to-r from-orange-500 to-red-700 hover:from-orange-600 hover:to-red-800 text-white font-medium text-xs shadow-md transition"
            >
              Launch Studio
            </Link>
          </div>
          <div className="lg:hidden md:flex flex-col justify-end">
            <button onClick={toggleNavbar} className="text-neutral-300">
              {mobileDrawerOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {mobileDrawerOpen && (
          <div className="fixed right-0 z-20 bg-neutral-900 w-full p-8 flex flex-col justify-center items-center lg:hidden border-b border-neutral-800">
            <ul className="space-y-4 text-center mb-6">
              <li>
                <Link to="/ocr" onClick={() => setMobileDrawerOpen(false)} className="text-white hover:text-orange-400">
                  Digitization Studio
                </Link>
              </li>
              <li>
                <Link to="/test" onClick={() => setMobileDrawerOpen(false)} className="text-white hover:text-orange-400">
                  Live OCR
                </Link>
              </li>
              <li>
                <Link to="/poly" onClick={() => setMobileDrawerOpen(false)} className="text-white hover:text-orange-400">
                  Form Assistant
                </Link>
              </li>
            </ul>
            <Link
              to="/ocr"
              onClick={() => setMobileDrawerOpen(false)}
              className="py-2.5 px-6 rounded-md bg-gradient-to-r from-orange-500 to-orange-800 text-white font-medium text-sm"
            >
              Launch Studio
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
