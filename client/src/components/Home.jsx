import Navbar from "./Navbar";
import HeroSection from "./HeroSection";
import FeatureSection from "./FeatureSection";
import Footer from "./Footer";
import Pricing from "./Pricing";
import Testimonials from "./Testimonials";

const Home = () => {
  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto pt-20 px-6">
        <HeroSection/>
        <FeatureSection/>
        <Pricing />
        <Testimonials />
        <Footer />
      </div>
    </>
  );
};

export default Home;