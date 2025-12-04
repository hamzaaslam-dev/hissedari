"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Menu, X, Wallet, ChevronDown } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const { connected, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/properties", label: "Properties" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      <div className="glass-card mx-4 mt-4 md:mx-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-accent-light flex items-center justify-center glow-gold-hover transition-all">
                <Building2 className="w-6 h-6 text-background" />
              </div>
              <span className="text-xl font-semibold tracking-tight">
                Sol<span className="text-gradient-gold">Estate</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-white/5 transition-all duration-300"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Wallet Connection */}
            <div className="hidden md:flex items-center space-x-4">
              {connected ? (
                <div className="relative">
                  <button
                    onClick={() => setShowWalletMenu(!showWalletMenu)}
                    className="flex items-center space-x-2 glass-card px-4 py-2 rounded-lg hover:border-accent/40 transition-all"
                  >
                    <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                    <span className="text-sm font-medium">
                      {formatAddress(publicKey?.toBase58() || "")}
                    </span>
                    <ChevronDown className="w-4 h-4 text-foreground-muted" />
                  </button>
                  
                  <AnimatePresence>
                    {showWalletMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute right-0 mt-2 w-48 glass-card rounded-lg overflow-hidden"
                      >
                        <Link
                          href="/dashboard"
                          className="block px-4 py-3 hover:bg-white/5 transition-colors"
                        >
                          My Portfolio
                        </Link>
                        <button
                          onClick={() => {
                            disconnect();
                            setShowWalletMenu(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors text-red-400"
                        >
                          Disconnect
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <button
                  onClick={() => setVisible(true)}
                  className="btn-primary flex items-center space-x-2"
                >
                  <Wallet className="w-4 h-4" />
                  <span>Connect Wallet</span>
                </button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden border-t border-glass-border"
            >
              <div className="px-4 py-4 space-y-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="block px-4 py-3 rounded-lg text-foreground-muted hover:text-foreground hover:bg-white/5 transition-all"
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="pt-4 border-t border-glass-border">
                  {connected ? (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 px-4 py-2">
                        <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                        <span className="text-sm">
                          {formatAddress(publicKey?.toBase58() || "")}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          disconnect();
                          setIsOpen(false);
                        }}
                        className="w-full px-4 py-3 text-left text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                      >
                        Disconnect Wallet
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setVisible(true);
                        setIsOpen(false);
                      }}
                      className="btn-primary w-full flex items-center justify-center space-x-2"
                    >
                      <Wallet className="w-4 h-4" />
                      <span>Connect Wallet</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
};

