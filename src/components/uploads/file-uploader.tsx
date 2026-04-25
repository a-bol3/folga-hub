"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, FileText, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploaderProps {
  label: string;
  onFileSelect: (file: File | null) => void;
  accept?: string;
}

export function FileUploader({ label, onFileSelect, accept = ".pdf,.jpg,.png" }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    onFileSelect(selectedFile);
  };

  const removeFile = () => {
    setFile(null);
    onFileSelect(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      
      {!file ? (
        <div 
          onClick={() => inputRef.current?.click()}
          className="group border border-dashed border-border p-10 cursor-pointer hover:border-primary transition-colors flex flex-col items-center justify-center bg-muted/5"
        >
          <input 
            type="file" 
            ref={inputRef} 
            onChange={handleFileChange} 
            accept={accept} 
            className="hidden" 
          />
          <Upload className="h-8 w-8 text-muted-foreground group-hover:text-primary mb-2 transition-colors" />
          <p className="text-xs font-bold uppercase tracking-tight">Click to upload document</p>
          <p className="text-[10px] text-muted-foreground mt-1 uppercase">PDF, JPG or PNG (Max 10MB)</p>
        </div>
      ) : (
        <div className="border p-4 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold uppercase truncate max-w-[200px]">{file.name}</span>
              <span className="text-[10px] text-muted-foreground font-bold uppercase">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={removeFile}
              className="h-8 w-8 text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
