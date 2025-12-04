"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  Building2,
  Shield,
  Coins,
  Globe2,
  TrendingUp,
  Users,
  ArrowRight,
  CheckCircle2,
  Zap,
  Lock,
  BarChart3,
} from "lucide-react";
import { PropertyCard } from "@/components/PropertyCard";
import { properties } from "@/data/properties";

export default function Home() {
  const stats = [
    { label: "Total Property Value", value: "PKR 966M+", icon: Building2 },
    { label: "Active Investors", value: "8,500+", icon: Users },
    { label: "Avg. Annual Yield", value: "10.6%", icon: TrendingUp },
    { label: "Cities", value: "7+", icon: Globe2 },
  ];

  const features = [
    {
      icon: Coins,
      title: "Fractional Ownership",
      description: "Own a piece of premium Pakistani real estate starting from just $40. No need for crores in capital.",
    },
    {
      icon: Shield,
      title: "Blockchain Security",
      description: "Every transaction is recorded on Solana blockchain, ensuring transparency and immutability.",
    },
    {
      icon: Zap,
      title: "Instant Liquidity",
      description: "Trade your property tokens 24/7 on our marketplace. No lengthy property sale processes.",
    },
    {
      icon: BarChart3,
      title: "Passive Income",
      description: "Earn rental income proportional to your ownership. Dividends distributed automatically in crypto.",
    },
    {
      icon: Globe2,
      title: "Nationwide Access",
      description: "Invest in properties across Pakistan - from Karachi to Islamabad, Lahore to Gwadar.",
    },
    {
      icon: Lock,
      title: "Legal Compliance",
      description: "All properties are fully vetted with proper documentation, NOCs, and SECP compliance.",
    },
  ];

  const howItWorks = [
    {
      step: "01",
      title: "Connect Wallet",
      description: "Link your Solana wallet (Phantom, Solflare) to access the platform securely.",
    },
    {
      step: "02",
      title: "Browse Properties",
      description: "Explore our curated selection of premium real estate opportunities worldwide.",
    },
    {
      step: "03",
      title: "Purchase Tokens",
      description: "Buy property tokens representing fractional ownership in your chosen property.",
    },
    {
      step: "04",
      title: "Earn Returns",
      description: "Receive rental income and benefit from property appreciation automatically.",
    },
  ];

  const featuredProperties = properties.slice(0, 3);

  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 animated-gradient" />
        <div className="absolute inset-0 grid-pattern" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        
        {/* Floating Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
          <div className="text-center">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 glass-card px-4 py-2 rounded-full mb-8"
            >
              <span className="solana-badge">Solana</span>
              <span className="text-sm text-foreground-muted">Powered by Blockchain</span>
            </motion.div>

            {/* Main Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              Invest in <span className="text-gradient-gold">Premium</span>
              <br />
              Real Estate
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xl md:text-2xl text-foreground-muted max-w-3xl mx-auto mb-10"
            >
              Own fractional shares of Pakistan&apos;s finest properties. 
              Start building your real estate portfolio with as little as $40.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link href="/properties" className="btn-primary flex items-center gap-2 text-lg">
                Explore Properties
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="#how-it-works" className="btn-secondary flex items-center gap-2 text-lg">
                How It Works
              </Link>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-wrap items-center justify-center gap-6 mt-12 text-sm text-foreground-muted"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-secondary" />
                <span>SECP Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-secondary" />
                <span>Audited Smart Contracts</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-secondary" />
                <span>Verified Properties</span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <div className="w-6 h-10 rounded-full border-2 border-foreground-muted/30 flex items-start justify-center p-1">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1.5 h-3 bg-accent rounded-full"
            />
          </div>
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="relative py-20 border-y border-glass-border bg-background-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent/10 mb-4">
                  <stat.icon className="w-6 h-6 text-accent" />
                </div>
                <p className="text-3xl md:text-4xl font-bold text-gradient-gold mb-2">{stat.value}</p>
                <p className="text-sm text-foreground-muted">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Properties */}
      <section className="relative py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-accent text-sm font-semibold uppercase tracking-wider">Featured</span>
            <h2 className="text-4xl md:text-5xl font-bold mt-2 mb-4" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Premium Properties
            </h2>
            <p className="text-foreground-muted max-w-2xl mx-auto">
              Discover exceptional real estate opportunities carefully selected for strong returns and growth potential.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredProperties.map((property, index) => (
              <PropertyCard key={property.id} property={property} index={index} />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <Link href="/properties" className="btn-secondary inline-flex items-center gap-2">
              View All Properties
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="relative py-24 bg-background-secondary">
        <div className="absolute inset-0 grid-pattern opacity-50" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-accent text-sm font-semibold uppercase tracking-wider">Process</span>
            <h2 className="text-4xl md:text-5xl font-bold mt-2 mb-4" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              How It Works
            </h2>
            <p className="text-foreground-muted max-w-2xl mx-auto">
              Start your real estate investment journey in four simple steps.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative"
              >
                <div className="glass-card p-6 h-full">
                  <span className="text-6xl font-bold text-accent/20">{item.step}</span>
                  <h3 className="text-xl font-semibold mt-4 mb-2">{item.title}</h3>
                  <p className="text-foreground-muted">{item.description}</p>
                </div>
                {index < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-px bg-glass-border" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="tokenization" className="relative py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-accent text-sm font-semibold uppercase tracking-wider">Benefits</span>
            <h2 className="text-4xl md:text-5xl font-bold mt-2 mb-4" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Why Choose SolEstate
            </h2>
            <p className="text-foreground-muted max-w-2xl mx-auto">
              Experience the future of real estate investment with blockchain technology.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="glass-card glass-card-hover p-6"
              >
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-foreground-muted">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass-card p-12 text-center relative overflow-hidden"
          >
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-accent/5 via-transparent to-secondary/5" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-accent/10 rounded-full blur-3xl -translate-y-1/2" />
            
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                Ready to Start Investing?
              </h2>
              <p className="text-foreground-muted mb-8 max-w-xl mx-auto">
                Join thousands of investors building wealth through tokenized real estate. 
                Connect your wallet and start your journey today.
              </p>
              <Link href="/properties" className="btn-primary inline-flex items-center gap-2 text-lg animate-pulse-glow">
                Get Started Now
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
