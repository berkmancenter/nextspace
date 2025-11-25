"use client";
import Link from "next/link";
import { Box, Divider } from "@mui/material";

interface FooterProps {
  className?: string;
}

/**
 * Footer component
 *
 * This component renders the footer for the app with copyright and links.
 * @param {object} props
 * @property {string} className - Optional Tailwind classes for styling.
 * @returns A React component for the footer.
 */
export const Footer = ({ className = "" }: FooterProps) => {
  const currentYear = new Date().getFullYear();

  // TODO actual URLs
  const footerLinks = [
    { label: "About", url: "/terms" },
    { label: "Privacy Policy", url: "/privacy" },
    { label: "Accessibility", url: "/accessibility" },
  ];

  return (
    <footer
      className={`${className} bg-white border-t border-gray-200 mt-auto`}
    >
      <Box className="container mx-auto px-4 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Copyright Section */}
          <div className="text-gray-600 text-sm">
            ©{currentYear} President and Fellows of Harvard College
          </div>

          {/* Links Section */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {footerLinks.map((link, index) => (
              <div key={link.label} className="flex items-center">
                <Link
                  href={link.url}
                  className="text-gray-600 hover:text-medium-slate-blue text-sm transition-colors duration-200"
                >
                  {link.label}
                </Link>
                {index < footerLinks.length - 1 && (
                  <Divider
                    orientation="vertical"
                    flexItem
                    sx={{
                      mx: 2,
                      height: "16px",
                      alignSelf: "center",
                      borderColor: "#d1d5db",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </Box>
    </footer>
  );
};

export default Footer;
