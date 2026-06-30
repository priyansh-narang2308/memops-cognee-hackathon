"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 bg-[#faf9f5] border border-[#e6dfd8] rounded-lg text-center">
          <AlertTriangle className="w-8 h-8 text-[#c64545] mb-3" />
          <h3 className="text-sm font-semibold text-[#141413] mb-1">
            Something went wrong
          </h3>
          <p className="text-xs text-[#6c6a64] mb-4 font-mono max-w-md">
            {this.state.error?.message ||
              "An unexpected error occurred in this section."}
          </p>
          <Button
            onClick={this.handleRetry}
            variant="outline"
            size="sm"
            className="gap-2 font-mono text-xs border-[#e6dfd8]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
