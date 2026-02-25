"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface FileUploadProps {
  onUpload: (urls: string[]) => void;
  multiple?: boolean;
  accept?: string;
  maxFiles?: number;
  folder?: string;
  label?: string;
  description?: string;
  existingFiles?: string[];
}

export function FileUpload({
  onUpload,
  multiple = false,
  accept = "image/*",
  maxFiles = 5,
  folder = "uploads",
  label = "Upload Files",
  description = "Drag and drop or click to upload",
  existingFiles = [],
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>(existingFiles);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    if (uploadedFiles.length + fileArray.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    setUploading(true);
    setError(null);

    const newUrls: string[] = [];

    for (const file of fileArray) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", folder);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Upload failed");
        }

        const data = await response.json();
        newUrls.push(data.url);
      } catch (err: any) {
        setError(err.message);
      }
    }

    if (newUrls.length > 0) {
      const allUrls = [...uploadedFiles, ...newUrls];
      setUploadedFiles(allUrls);
      onUpload(allUrls);
    }

    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleRemove = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    onUpload(newFiles);
  };

  const isPDF = (url: string) => url.toLowerCase().endsWith(".pdf");

  return (
    <div className="space-y-4">
      <label className="block text-gray-300 font-medium">{label}</label>

      {/* Upload Area */}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          dragOver
            ? "border-emerald-500 bg-emerald-500/10"
            : "border-white/20 hover:border-white/40 bg-white/5"
        } ${uploading ? "pointer-events-none opacity-50" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />

        {uploading ? (
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-3" />
            <p className="text-gray-400">Uploading...</p>
          </div>
        ) : (
          <>
            <div className="text-4xl mb-3">📁</div>
            <p className="text-gray-300 font-medium">{description}</p>
            <p className="text-gray-500 text-sm mt-1">
              {accept.includes("pdf") ? "PDF, JPEG, PNG" : "JPEG, PNG, WebP"} • Max 10MB
              {multiple && ` • Up to ${maxFiles} files`}
            </p>
          </>
        )}
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 flex items-center gap-2"
          >
            <span>⚠️</span>
            <span className="text-red-300 text-sm">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Uploaded Files Preview */}
      {uploadedFiles.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {uploadedFiles.map((url, index) => (
            <motion.div
              key={url}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative group"
            >
              {isPDF(url) ? (
                <div className="w-full h-24 bg-white/10 rounded-lg flex flex-col items-center justify-center">
                  <span className="text-3xl">📄</span>
                  <span className="text-xs text-gray-400 mt-1">PDF</span>
                </div>
              ) : (
                <img
                  src={url}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-24 object-cover rounded-lg"
                />
              )}
              <button
                onClick={() => handleRemove(index)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
