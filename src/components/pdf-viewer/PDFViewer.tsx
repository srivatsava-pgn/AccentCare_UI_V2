import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SelectionCoords, SelectedArea, DocumentContent, HighlightedEvidence, SearchHighlight } from '../../types';

interface PDFViewerProps {
  selectedDocument: string;
  currentPage: number;
  zoomLevel: number;
  highlightedEvidence: HighlightedEvidence | null;
  showHighlight: boolean;
  searchHighlight: SearchHighlight | null;
  isAddingICD: boolean;
  isTransitioning: boolean;
  onAreaSelected: (area: SelectedArea) => void;
  imageRef: React.MutableRefObject<HTMLImageElement | null>;
  documentContent: Record<string, Record<number, DocumentContent>>;
  allImagesLoaded?: boolean;
  onPageChange?: (page: number) => void; // Add callback for page changes
  targetPage?: number; // Add target page prop for navigation
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  selectedDocument,
  currentPage,
  zoomLevel,
  highlightedEvidence,
  showHighlight,
  searchHighlight,
  isAddingICD,
  isTransitioning,
  onAreaSelected,
  imageRef,
  documentContent,
  allImagesLoaded = false,
  onPageChange,
  targetPage = 1
}) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<SelectionCoords | null>(null);
  const [selectionCurrent, setSelectionCurrent] = useState<SelectionCoords | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  
  // Scroll container ref for smooth scrolling
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement>>({});
  const imageRefs = useRef<Record<number, HTMLImageElement>>({});
  const [isScrolling, setIsScrolling] = useState(false);
  const [visiblePageInCenter, setVisiblePageInCenter] = useState(currentPage);
  
  // Keyboard state management
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const pressedKeysRef = useRef<Set<string>>(new Set());
  
  // Animation frame refs for smooth scrolling
  const scrollAnimationRef = useRef<number | null>(null);
  const keyboardIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const keyboardTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const scrollToPageTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get all pages for the current document
  const currentDocumentPages = documentContent[selectedDocument] || {};
  const pageNumbers = Object.keys(currentDocumentPages).map(Number).sort((a, b) => a - b);

  // Enhanced smooth scroll function with easing - MOVED UP to be available for other functions
  const smoothScrollTo = useCallback((targetScroll: number, duration: number = 300) => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const startScroll = container.scrollTop;
    const distance = targetScroll - startScroll;
    
    // If distance is very small, just set it directly
    if (Math.abs(distance) < 5) {
      container.scrollTop = targetScroll;
      setIsScrolling(false);
      return;
    }
    
    const startTime = performance.now();
    
    // Cancel any existing animation
    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
    }
    
    const animateScroll = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out-cubic)
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      
      container.scrollTop = startScroll + distance * easeOutCubic;
      
      if (progress < 1) {
        scrollAnimationRef.current = requestAnimationFrame(animateScroll);
      } else {
        scrollAnimationRef.current = null;
        setIsScrolling(false);
      }
    };
    
    setIsScrolling(true);
    scrollAnimationRef.current = requestAnimationFrame(animateScroll);
  }, []);

  // Direct scroll function for continuous keyboard scrolling
  const directScroll = useCallback((scrollAmount: number) => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const targetScroll = Math.max(0, Math.min(
      container.scrollHeight - container.clientHeight,
      container.scrollTop + scrollAmount
    ));
    
    container.scrollTop = targetScroll;
  }, []);

  // Set up intersection observer to track which page is most visible
  useEffect(() => {
    if (!scrollContainerRef.current || pageNumbers.length === 0) return;

    // Clean up existing observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the page with the highest intersection ratio that's at least 30% visible
        let mostVisiblePage = visiblePageInCenter;
        let highestRatio = 0;

        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > highestRatio && entry.intersectionRatio >= 0.3) {
            const pageElement = entry.target as HTMLElement;
            const pageNumber = parseInt(pageElement.dataset.pageNumber || '1');
            if (!isNaN(pageNumber)) {
              mostVisiblePage = pageNumber;
              highestRatio = entry.intersectionRatio;
            }
          }
        });

        // Update visible page if it changed
        if (mostVisiblePage !== visiblePageInCenter) {
          setVisiblePageInCenter(mostVisiblePage);
          // Notify parent component about page change
          if (onPageChange) {
            onPageChange(mostVisiblePage);
          }
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '-20% 0px -20% 0px', // Only consider pages in the center 60% of viewport
        threshold: [0.1, 0.3, 0.5, 0.7, 0.9] // Multiple thresholds for better detection
      }
    );

    // Observe all page elements
    pageNumbers.forEach((pageNumber) => {
      const pageElement = pageRefs.current[pageNumber];
      if (pageElement) {
        observer.observe(pageElement);
      }
    });

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [pageNumbers, selectedDocument, visiblePageInCenter, onPageChange]);

  // Smooth scroll to specific page function
  const scrollToPage = useCallback((pageNumber: number) => {
    if (!scrollContainerRef.current || !pageRefs.current[pageNumber]) return;
    
    const container = scrollContainerRef.current;
    const pageElement = pageRefs.current[pageNumber];
    
    // Clear any existing scroll timeout
    if (scrollToPageTimeoutRef.current) {
      clearTimeout(scrollToPageTimeoutRef.current);
    }
    
    // Calculate the target scroll position
    const containerRect = container.getBoundingClientRect();
    const pageRect = pageElement.getBoundingClientRect();
    
    // Calculate offset to center the page in the viewport
    const containerCenter = containerRect.height / 2;
    const pageCenter = pageRect.height / 2;
    const targetOffset = pageRect.top - containerRect.top - containerCenter + pageCenter;
    
    const targetScroll = container.scrollTop + targetOffset;
    
    // Use smooth scrolling with longer duration for page navigation
    smoothScrollTo(targetScroll, 800);
    
    // Update visible page after scroll completes
    scrollToPageTimeoutRef.current = setTimeout(() => {
      setVisiblePageInCenter(pageNumber);
      if (onPageChange) {
        onPageChange(pageNumber);
      }
    }, 850); // Slightly longer than scroll duration
  }, [smoothScrollTo, onPageChange]);

  // Effect to handle target page changes (when navigating to a specific page)
  useEffect(() => {
    if (targetPage && targetPage !== visiblePageInCenter && pageRefs.current[targetPage]) {
      // Small delay to ensure page elements are rendered
      const timeout = setTimeout(() => {
        scrollToPage(targetPage);
      }, 100);
      
      return () => clearTimeout(timeout);
    }
  }, [targetPage, visiblePageInCenter, scrollToPage]);

  // Add escape key handler to disable cross-hair mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAddingICD) {
        // Cancel ICD addition mode by dispatching a custom event
        const event = new CustomEvent('cancelICDAddition');
        document.dispatchEvent(event);
      }
    };

    // Add event listener when in ICD adding mode
    if (isAddingICD) {
      document.addEventListener('keydown', handleKeyDown);
    }

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAddingICD]);

  // Enhanced mouse wheel handler with momentum and trackpad support
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!scrollContainerRef.current || isTransitioning) return;
      
      e.preventDefault();
      
      const container = scrollContainerRef.current;
      
      // Simplified scroll handling - use deltaY directly with slight damping
      // This works well for both mouse wheel and trackpad
      let scrollAmount = e.deltaY;
      
      // Apply slight damping for smoother experience
      if (e.deltaMode === 0) {
        // Pixel mode (trackpad) - use direct delta with light damping
        scrollAmount = e.deltaY * 0.8;
      } else {
        // Line/page mode (mouse wheel) - normalize to reasonable pixel values
        scrollAmount = e.deltaY * 40;
      }
      
      const targetScroll = Math.max(0, Math.min(
        container.scrollHeight - container.clientHeight,
        container.scrollTop + scrollAmount
      ));
      
      // Use direct scroll for immediate, responsive feel
      // This eliminates the jittery behavior from mixing direct and animated scrolling
      container.scrollTop = targetScroll;
    };

    const container = scrollContainerRef.current;
    if (container) {
      // Use passive: false to allow preventDefault
      container.addEventListener('wheel', handleWheel, { passive: false });
      
      return () => {
        container.removeEventListener('wheel', handleWheel);
      };
    }
  }, [isTransitioning, smoothScrollTo]);

  // Enhanced keyboard navigation with proper held key handling
  useEffect(() => {
    // Update ref when state changes
    pressedKeysRef.current = pressedKeys;
  }, [pressedKeys]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if any modal is open or if user is typing in an input/textarea
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.closest('[role="dialog"]') || // Modal check
        activeElement.closest('.modal') // Additional modal check
      )) {
        return;
      }

      // Handle arrow keys and other navigation keys
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        
        if (isTransitioning) return;
        
        // Check if this key is already pressed (for held keys) using ref
        const wasAlreadyPressed = pressedKeysRef.current.has(e.key);
        
        // Add key to pressed keys set
        setPressedKeys(prev => new Set([...prev, e.key]));
        pressedKeysRef.current.add(e.key);
        
        // If this is the first time this key is pressed
        if (!wasAlreadyPressed) {
          handleInitialKeyPress(e);
          
          // Start continuous scrolling after a delay
          startContinuousScrolling(e.key);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
        // Remove key from pressed keys set
        setPressedKeys(prev => {
          const newSet = new Set(prev);
          newSet.delete(e.key);
          pressedKeysRef.current.delete(e.key);
          
          // If no more keys are pressed, stop continuous scrolling
          if (newSet.size === 0) {
            stopContinuousScrolling();
            setIsKeyboardActive(false);
          }
          
          return newSet;
        });
      }
    };

    const handleInitialKeyPress = (e: KeyboardEvent) => {
      if (!scrollContainerRef.current) return;
      
      setIsKeyboardActive(true);
      
      const container = scrollContainerRef.current;
      const containerHeight = container.clientHeight;
      
      // Calculate scroll amount based on key and modifiers
      let scrollAmount: number;
      
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (e.ctrlKey || e.metaKey) {
          // Ctrl/Cmd + Arrow: Jump to top/bottom
          scrollAmount = e.key === 'ArrowUp' ? -container.scrollHeight : container.scrollHeight;
        } else if (e.shiftKey) {
          // Shift + Arrow: Page scroll
          scrollAmount = e.key === 'ArrowUp' ? -containerHeight * 0.8 : containerHeight * 0.8;
        } else {
          // Normal arrow: Smooth incremental scroll
          scrollAmount = e.key === 'ArrowUp' ? -150 : 150;
        }
      } else if (e.key === 'PageUp' || e.key === 'PageDown') {
        scrollAmount = e.key === 'PageUp' ? -containerHeight * 0.9 : containerHeight * 0.9;
      } else if (e.key === 'Home' || e.key === 'End') {
        scrollAmount = e.key === 'Home' ? -container.scrollHeight : container.scrollHeight;
      } else {
        return;
      }
      
      const targetScroll = Math.max(0, Math.min(
        container.scrollHeight - container.clientHeight,
        container.scrollTop + scrollAmount
      ));
      
      // For initial press, use smooth scrolling
      if (e.ctrlKey || e.metaKey || e.key === 'Home' || e.key === 'End') {
        smoothScrollTo(targetScroll, 800);
      } else if (e.shiftKey || e.key === 'PageUp' || e.key === 'PageDown') {
        smoothScrollTo(targetScroll, 500);
      } else {
        smoothScrollTo(targetScroll, 300);
      }
    };

    const startContinuousScrolling = (key: string) => {
      // Clear any existing interval and timeout
      stopContinuousScrolling();
      
      // Start continuous scrolling after a delay (to allow initial smooth scroll)
      keyboardTimeoutRef.current = setTimeout(() => {
        keyboardIntervalRef.current = setInterval(() => {
          // Check if the key is still pressed using ref for real-time check
          if (pressedKeysRef.current.has(key) && scrollContainerRef.current) {
            // Calculate scroll amount for continuous scrolling (smaller increments)
            let scrollAmount: number;
            
            if (key === 'ArrowUp') {
              scrollAmount = -80; // Continuous scroll speed
            } else if (key === 'ArrowDown') {
              scrollAmount = 80;
            } else if (key === 'PageUp') {
              scrollAmount = -300;
            } else if (key === 'PageDown') {
              scrollAmount = 300;
            } else {
              return;
            }
            
            // Use direct scroll for continuous movement
            directScroll(scrollAmount);
          } else {
            // Key is no longer pressed, stop continuous scrolling
            stopContinuousScrolling();
          }
        }, 50); // 50ms interval for smooth continuous scrolling
      }, 300); // Wait 300ms before starting continuous scroll
    };

    const stopContinuousScrolling = () => {
      if (keyboardIntervalRef.current) {
        clearInterval(keyboardIntervalRef.current);
        keyboardIntervalRef.current = null;
      }
      if (keyboardTimeoutRef.current) {
        clearTimeout(keyboardTimeoutRef.current);
        keyboardTimeoutRef.current = null;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      stopContinuousScrolling();
      // Clear the ref on cleanup
      pressedKeysRef.current.clear();
    };
  }, [isTransitioning, smoothScrollTo, directScroll]);

  // Cleanup animation frames and intervals on unmount
  useEffect(() => {
    return () => {
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
      }
      if (keyboardIntervalRef.current) {
        clearInterval(keyboardIntervalRef.current);
      }
      if (keyboardTimeoutRef.current) {
        clearTimeout(keyboardTimeoutRef.current);
      }
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (scrollToPageTimeoutRef.current) {
        clearTimeout(scrollToPageTimeoutRef.current);
      }
    };
  }, []);

  // Register scroll to page function with parent component
  useEffect(() => {
    // This would be called by parent if they need direct scroll control
  }, []);

  // Helper function to format filename
  const formatFileName = (fileName: string): string => {
    const parts = fileName.split('.');
    if (parts.length > 1) {
      // Remove the last part (extension) and join the rest
      return parts.slice(0, -1).join('.');
    }
    return fileName;
  };

  // FIXED: Use rendered dimensions instead of natural dimensions for normalization
  const normalizeCoordinates = (pixelCoords: any, imageElement: HTMLImageElement) => {
    // Use the rendered dimensions (offsetWidth/offsetHeight) instead of natural dimensions
    // This ensures consistency between coordinate capture and display
    const { offsetWidth, offsetHeight } = imageElement;
    
    return {
      x_min: pixelCoords.x_min / offsetWidth,
      y_min: pixelCoords.y_min / offsetHeight,
      x_max: pixelCoords.x_max / offsetWidth,
      y_max: pixelCoords.y_max / offsetHeight
    };
  };

  const handleImageMouseDown = (e: React.MouseEvent, pageNumber: number) => {
    if (!isAddingICD || isTransitioning) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsSelecting(true);
    setSelectionStart({ x, y });
    setSelectionCurrent({ x, y });
    e.preventDefault();
  };

  const handleImageMouseMove = (e: React.MouseEvent, pageNumber: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Update mouse position for glowing cursor (use screen coordinates for display)
    if (isAddingICD && !isTransitioning) {
      setMousePosition({ x, y });
    }
    
    if (!isSelecting || !isAddingICD || isTransitioning) return;
    
    setSelectionCurrent({ x, y });
  };

  const handleImageMouseUp = (e: React.MouseEvent, pageNumber: number) => {
    if (!isSelecting || !isAddingICD || !selectionStart || isTransitioning) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const imageElement = e.currentTarget as HTMLImageElement;
    
    if (imageElement) {
      // Use screen coordinates for pixel coords (relative to the rendered image)
      const pixelCoords = {
        x_min: Math.min(selectionStart.x, x),
        y_min: Math.min(selectionStart.y, y),
        x_max: Math.max(selectionStart.x, x),
        y_max: Math.max(selectionStart.y, y)
      };
      
      // FIXED: Now using rendered dimensions for proper normalization
      const normalizedCoords = normalizeCoordinates(pixelCoords, imageElement);
      
      const selectedArea: SelectedArea = {
        ...normalizedCoords,
        document: selectedDocument,
        page: pageNumber,
        pixelCoords: pixelCoords
      };
      
      onAreaSelected(selectedArea);
    }
    
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionCurrent(null);
  };

  const handleImageMouseLeave = () => {
    // Clear mouse position when leaving the image area
    setMousePosition(null);
  };

  // Calculate highlight box with clearance and rounded corners
  const getHighlightStyle = (pageNumber: number, imageElement: HTMLImageElement) => {
    if (!highlightedEvidence || !showHighlight || highlightedEvidence.page !== pageNumber) return {};

    const imgWidth = imageElement.offsetWidth;
    const imgHeight = imageElement.offsetHeight;
    const bbox = highlightedEvidence.boundingBox;
    
    // Calculate base dimensions using rendered image dimensions
    const baseLeft = bbox.x_min * imgWidth;
    const baseTop = bbox.y_min * imgHeight;
    const baseWidth = (bbox.x_max - bbox.x_min) * imgWidth;
    const baseHeight = (bbox.y_max - bbox.y_min) * imgHeight;
    
    // Add clearance on all sides (8px padding)
    const clearance = 8;
    const left = Math.max(0, baseLeft - clearance);
    const top = Math.max(0, baseTop - clearance);
    const right = Math.min(imgWidth, baseLeft + baseWidth + clearance);
    const bottom = Math.min(imgHeight, baseTop + baseHeight + clearance);
    
    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${right - left}px`,
      height: `${bottom - top}px`,
      borderRadius: '12px',
    };
  };

  // Calculate search highlight box style
  const getSearchHighlightStyle = (pageNumber: number, imageElement: HTMLImageElement) => {
    if (!searchHighlight || searchHighlight.page !== pageNumber) return {};

    const imgWidth = imageElement.offsetWidth;
    const imgHeight = imageElement.offsetHeight;
    const bbox = searchHighlight.boundingBox;
    
    // Calculate dimensions using rendered image dimensions
    const left = bbox.x_min * imgWidth;
    const top = bbox.y_min * imgHeight;
    const width = (bbox.x_max - bbox.x_min) * imgWidth;
    const height = (bbox.y_max - bbox.y_min) * imgHeight;
    
    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      borderRadius: '2px',
    };
  };

  if (pageNumbers.length === 0) {
    return (
      <div className={`flex-1 overflow-auto font-sans ${isAddingICD ? 'cursor-crosshair' : ''}`} style={{ backgroundColor: '#f8f9fa' }}>
        <div className="h-full flex items-center justify-center">
          <div className="text-center py-8 text-gray-500">
            <p className="font-semibold">Document content not available</p>
            <p className="text-sm mt-2">Please select a document from the dropdown above</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`flex-1 overflow-hidden font-sans relative ${isAddingICD && !isTransitioning ? 'cursor-none' : ''}`}
      style={{ backgroundColor: '#f8f9fa' }}
    >
      {/* Corner Elements - Fixed Position */}
      <div className="absolute top-4 left-4 z-10">
        <div className={`bg-white/90 backdrop-blur-sm px-3 py-1 rounded-lg shadow-sm border border-gray-200 transition-all duration-300 ${
          isTransitioning ? 'opacity-50' : 'opacity-100'
        }`}>
          <span className="text-sm font-medium text-gray-700">
            {formatFileName(selectedDocument)}
          </span>
        </div>
      </div>
      
      <div className="absolute top-4 right-4 z-10">
        <div className={`bg-white/90 backdrop-blur-sm px-3 py-1 rounded-lg shadow-sm border border-gray-200 transition-all duration-300 ${
          isTransitioning ? 'opacity-50' : 'opacity-100'
        }`}>
          <span className="text-sm text-gray-600">Pg</span>
          <span className="text-sm font-medium text-red-600 ml-1">{visiblePageInCenter}</span>
          <span className="text-sm text-gray-600 ml-1">of {pageNumbers.length}</span>
        </div>
      </div>

      {/* Loading indicator when images are not ready */}
      {!allImagesLoaded && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg border border-blue-500">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-bold">Loading images for smooth scrolling...</span>
            </div>
          </div>
        </div>
      )}

      {/* ICD Selection Mode Indicator */}
      {isAddingICD && !isTransitioning && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg border border-blue-500 animate-pulse">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
              <span className="text-sm font-bold">Highlight on pdf</span>
              <span className="text-xs bg-blue-500 px-2 py-1 rounded ml-2">Press ESC to cancel</span>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard shortcuts indicator */}
      <div className="absolute bottom-4 right-4 z-10">
        <div className="bg-black/70 text-white px-3 py-2 rounded-lg text-xs">
          <div className="space-y-1">
            <div>↑↓ Scroll • Shift+↑↓ Page • Ctrl+↑↓ Top/Bottom</div>
            <div>PgUp/PgDn Page • Home/End Document</div>
            <div className="text-yellow-300">Hold keys for continuous scroll</div>
          </div>
        </div>
      </div>

      {/* Scrollable PDF Container */}
      <div 
        ref={scrollContainerRef}
        className={`h-full overflow-y-auto overflow-x-hidden pdf-scroll-container ${
          isScrolling ? 'pdf-scrolling' : ''
        }`}
        style={{ 
          scrollBehavior: 'auto', // We handle smooth scrolling manually
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 #f1f5f9'
        }}
      >
        {/* PDF Content Container - All Pages Stacked Vertically */}
        <div className="min-h-full flex flex-col items-center py-8 px-4 gap-6">
          {pageNumbers.map((pageNumber) => {
            const pageContent = currentDocumentPages[pageNumber];
            if (!pageContent) return null;

            return (
              <div 
                key={pageNumber}
                ref={(el) => {
                  if (el) {
                    pageRefs.current[pageNumber] = el;
                    // Set data attribute for intersection observer
                    el.dataset.pageNumber = pageNumber.toString();
                  }
                }}
                className={`bg-white shadow-lg rounded-lg overflow-hidden transition-all duration-500 ${
                  isTransitioning ? 'opacity-30 blur-sm scale-95' : 'opacity-100 blur-0 scale-100'
                } ${
                  pageNumber === visiblePageInCenter ? 'ring-2 ring-blue-500 ring-opacity-50 shadow-xl' : ''
                } pdf-page-smooth`}
                style={{ 
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: 'center center',
                  transition: pageNumber === targetPage 
                    ? 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)' 
                    : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  filter: pageNumber === targetPage ? 'brightness(1.05)' : 'brightness(1)',
                  maxWidth: '100%',
                  width: 'fit-content'
                }}
              >
                {/* Page Number Badge */}
                <div className="absolute top-3 left-3 z-10">
                  <div className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-300 ${
                    pageNumber === visiblePageInCenter 
                      ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-300' 
                      : 'bg-gray-800 text-white'
                  }`}>
                    Page {pageNumber}
                  </div>
                </div>

                {/* Image Container with Selection Overlay */}
                <div className="relative inline-block">
                  <img
                    ref={(el) => {
                      if (el) {
                        imageRefs.current[pageNumber] = el;
                        // Also set the main imageRef for the visible page
                        if (pageNumber === visiblePageInCenter) {
                          imageRef.current = el;
                        }
                      }
                    }}
                    src={pageContent.imageUrl}
                    alt={`${pageContent.title} - Page ${pageNumber}`}
                    className="max-w-full h-auto block transition-all duration-300"
                    onMouseDown={(e) => handleImageMouseDown(e, pageNumber)}
                    onMouseMove={(e) => handleImageMouseMove(e, pageNumber)}
                    onMouseUp={(e) => handleImageMouseUp(e, pageNumber)}
                    onMouseLeave={handleImageMouseLeave}
                    draggable={false}
                    style={{ 
                      userSelect: 'none',
                      pointerEvents: isTransitioning ? 'none' : 'auto',
                      filter: isTransitioning ? 'brightness(0.7) contrast(0.8)' : 'brightness(1) contrast(1)',
                      width: 'auto',
                      height: 'auto'
                    }}
                    onError={(e) => {
                      console.error('Image failed to load:', pageContent.imageUrl);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  
                  {/* Glowing Cursor Ring - Only show when in ICD selection mode */}
                  {isAddingICD && !isTransitioning && mousePosition && (
                    <div
                      className="absolute pointer-events-none z-30"
                      style={{
                        left: `${mousePosition.x - 20}px`,
                        top: `${mousePosition.y - 20}px`,
                        width: '40px',
                        height: '40px',
                      }}
                    >
                      <div className="w-full h-full rounded-full border-2 border-blue-500 bg-blue-200 bg-opacity-20 glow-cursor">
                        <div className="w-full h-full rounded-full border border-blue-400 animate-ping"></div>
                      </div>
                      {/* Center dot */}
                      <div 
                        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-blue-600 rounded-full"
                      ></div>
                    </div>
                  )}
                  
                  {/* Highlighted Evidence Bounding Box with Enhanced UX */}
                  {!isTransitioning && highlightedEvidence && showHighlight &&
                   highlightedEvidence.document === selectedDocument && 
                   highlightedEvidence.page === pageNumber && 
                   imageRefs.current[pageNumber] && (
                    <div
                      className="absolute pointer-events-none transition-all duration-700 ease-in-out yellow-glow-border"
                      style={getHighlightStyle(pageNumber, imageRefs.current[pageNumber])}
                    />
                  )}
                  
                  {/* Search Highlight Bounding Box */}
                  {!isTransitioning && searchHighlight &&
                   searchHighlight.document === selectedDocument && 
                   searchHighlight.page === pageNumber && 
                   imageRefs.current[pageNumber] && (
                    <div
                      className="absolute border-2 border-green-700 bg-green-500 bg-opacity-20 pointer-events-none transition-all duration-300"
                      style={getSearchHighlightStyle(pageNumber, imageRefs.current[pageNumber])}
                      title={`Search match: "${searchHighlight.textSnippet}"`}
                    />
                  )}
                  
                  {/* Active Selection Overlay - Uses screen coordinates for display */}
                  {!isTransitioning && isSelecting && selectionStart && selectionCurrent && (
                    <div
                      className="absolute border-2 border-dashed border-blue-500 bg-blue-200 bg-opacity-20 pointer-events-none"
                      style={{
                        left: `${Math.min(selectionStart.x, selectionCurrent.x)}px`,
                        top: `${Math.min(selectionStart.y, selectionCurrent.y)}px`,
                        width: `${Math.abs(selectionCurrent.x - selectionStart.x)}px`,
                        height: `${Math.abs(selectionCurrent.y - selectionStart.y)}px`,
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
          
          {/* Spacer for better scrolling experience */}
          <div className="h-32"></div>
        </div>
      </div>
    </div>
  );
};