"use client";

import Link from "next/link";
import { Building2, Twitter, Github, MessageCircle } from "lucide-react";

export const Footer = () => {
  const footerLinks = {
    platform: [
      { label: "Properties", href: "/properties" },
      { label: "How It Works", href: "/#how-it-works" },
      { label: "Tokenization", href: "/#tokenization" },
      { label: "Dashboard", href: "/dashboard" },
    ],
    resources: [
      { label: "Documentation", href: "#" },
      { label: "Whitepaper", href: "#" },
      { label: "FAQs", href: "#" },
      { label: "Blog", href: "#" },
    ],
    legal: [
      { label: "Terms of Service", href: "#" },
      { label: "Privacy Policy", href: "#" },
      { label: "Risk Disclosure", href: "#" },
    ],
  };

  return (
    <footer className="relative border-t border-glass-border bg-background-secondary">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent opacity-50 pointer-events-none" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center space-x-2 group mb-6">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-accent-light flex items-center justify-center">
                <Building2 className="w-6 h-6 text-background" />
              </div>
              <span className="text-xl font-semibold tracking-tight">
                Sol<span className="text-gradient-gold">Estate</span>
              </span>
            </Link>
            <p className="text-foreground-muted mb-6 max-w-sm">
              Democratizing real estate investment in Pakistan through blockchain technology. 
              Own fractional shares of premium properties across the nation.
            </p>
            <div className="flex items-center space-x-4">
              <a
                href="#"
                className="w-10 h-10 rounded-lg glass-card flex items-center justify-center hover:border-accent/40 transition-all"
              >
                <Twitter className="w-5 h-5 text-foreground-muted hover:text-accent transition-colors" />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-lg glass-card flex items-center justify-center hover:border-accent/40 transition-all"
              >
                <MessageCircle className="w-5 h-5 text-foreground-muted hover:text-accent transition-colors" />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-lg glass-card flex items-center justify-center hover:border-accent/40 transition-all"
              >
                <Github className="w-5 h-5 text-foreground-muted hover:text-accent transition-colors" />
              </a>
            </div>
          </div>

          {/* Platform Links */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-accent mb-4">
              Platform
            </h4>
            <ul className="space-y-3">
              {footerLinks.platform.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-foreground-muted hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-accent mb-4">
              Resources
            </h4>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-foreground-muted hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-accent mb-4">
              Legal
            </h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-foreground-muted hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-glass-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-foreground-muted">
            © {new Date().getFullYear()} SolEstate. All rights reserved.
          </p>
          <div className="flex items-center space-x-2 text-sm text-foreground-muted">
            <span>Powered by</span>
            <span className="solana-badge">Solana</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

