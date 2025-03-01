import { BotMessageSquare } from "lucide-react";
import { ShieldHalf } from "lucide-react";
import { PlugZap } from "lucide-react";
import { GlobeLock } from "lucide-react";

import user1 from "../assets/profile-pictures/user1.jpg";
import user2 from "../assets/profile-pictures/user2.jpg";
import user3 from "../assets/profile-pictures/user3.jpg";
export const navItems = [
  { label: "Features", href: "#" },
  { label: "Pricing", href: "#" },
  { label: "Testimonials", href: "#" },
];

export const testimonials = [
  {
    user: "Sample testimonial 1",
    company: "X Company",
    image: user1,
    text: "I am extremely satisfied with the services provided. The feature was responsive and delivered results beyond my expectations.",
  },
  {
    user: "Sample testimonial 2",
    company: "Y Company",
    image: user2,
    text: "I couldn't be happier with the outcome of our project. The team's creativity and problem-solving skills were instrumental in bringing their vision to life",
  },
  {
    user: "Sample testimonial 3",
    company: "Z Company",
    image: user3,
    text: "The feature overall was a success. I look forward to use this again in the future. Helped clear a lot of docs and perform quick tasks on docs with only voice.",
  },
];

export const features = [
  {
    icon: <BotMessageSquare />,
    text: "Upload Files",
    description:
      "You can upload your documents and get it reviewed easily and you can also fill forms easliy using our feature. ",
  },
  {
    icon: <ShieldHalf />,
    text: "Automation Form Filling",
    description:
      "Automation form filling involves using software to automatically complete forms based on user inputs simultaneously using voice or text.",
  },
  {
    icon: <PlugZap />,
    text: "Image to Text Conversion",
    description:
      "Image to text conversion using Tesseract extracts and converts text from images into editable, machine-readable format.",
  },
  {
    icon: <GlobeLock />,
    text: "Get Processed Text",
    description:
      "Processed text retrieves and highlights characters that were faded or unclear in the document, improving readability and accuracy.",
  },
];

export const pricingOptions = [
  {
    title: "Free",
    price: "₹0",
    features: [
      "Limited Usuage",
      "Ads",
      "WaterMarks",
      "Basic Features",
    ],
  },
  {
    title: "Pro",
    price: "₹49",
    features: [
      "Priority Support",
      "No Ads",
      "No WaterMarks",
      "Moderate Usage",
    ],
  },
  {
    title: "Pro+",
    price: "₹199",
    features: [
      "Unlimited Usage",
      "Developer Tools",
      "Early Access to new Feature",
      "Advanced Features",
    ],
  },
];

export const resourcesLinks = [
  { href: "#", text: "Getting Started" },
  { href: "#", text: "Tutorials" },
  { href: "#", text: "References" },
];
