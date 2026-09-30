import React from "react";
import { features } from "../constants";

const FeatureSection = () => {
  return (
    <div id="features" className="relative mt-20 border-b border-neutral-800 pb-16">
      <div className="text-center">
        <span className="bg-neutral-900 text-orange-500 rounded-full h-6 text-xs font-semibold px-3 py-1 uppercase tracking-wider border border-neutral-800">
          Core Capabilities
        </span>
        <h2 className="text-3xl sm:text-5xl lg:text-6xl mt-8 tracking-tight font-extrabold">
          State-of-the-Art{" "}
          <span className="bg-gradient-to-r from-orange-500 via-amber-500 to-red-600 text-transparent bg-clip-text">
            Handwritten Digitization
          </span>
        </h2>
        <p className="mt-4 text-sm sm:text-base text-neutral-400 max-w-2xl mx-auto">
          Combining computer vision preprocessing, multi-model optical character consensus, and multimodal generative AI for historical and administrative record preservation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-14 max-w-6xl mx-auto">
        {features.map((feature, index) => (
          <div
            key={index}
            className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 hover:border-orange-500/40 transition-all flex items-start gap-4 shadow-lg backdrop-blur-sm"
          >
            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex-shrink-0 shadow">
              {feature.icon}
            </div>
            <div>
              <h5 className="text-lg font-semibold text-white mb-2">{feature.text}</h5>
              <p className="text-sm text-neutral-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeatureSection;