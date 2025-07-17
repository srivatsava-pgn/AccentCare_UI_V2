import { MoreHorizontal } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useCodingState } from "../../hooks/useCodingState";
import { useDocumentViewer } from "../../hooks/useDocumentViewer";
import { useICDSearch } from "../../hooks/useICDSearch";
import { usePdfSearch } from "../../hooks/usePdfSearch";
import { useResizablePanel } from "../../hooks/useResizablePanel";
import {
  ApiReviewStats,
  CodeSuggestion as CodeSuggestionType,
  Document,
  DocumentContent,
  SelectedArea,
} from "../../types";
import { ICDModal } from "../medical-suggestions/ICDModal";
import { PDFViewer } from "../pdf-viewer/PDFViewer";
import { BrandedHeader } from "./BrandedHeader";
import { CodingHeader } from "./CodingHeader";
import { MedicalSuggestionsPanel } from "./MedicalSuggestionsPanel";

interface CodingInterfaceProps {
  selectedEpisodeDocId: string;
  documents: Document[];
  documentContent: Record<string, Record<number, DocumentContent>>;
  primarySuggestions: CodeSuggestionType[];
  secondarySuggestions: CodeSuggestionType[];
  reviewStats: ApiReviewStats | null;
  comments: Record<string, any[]>;
  onReturnToDashboard: () => void;
  onLogout?: () => void;
  timerStartTime?: string;
  onTimerUpdate?: (time: string) => void;
}

export const CodingInterface: React.FC<CodingInterfaceProps> = ({
  selectedEpisodeDocId,
  documents,
  documentContent,
  primarySuggestions,
  secondarySuggestions,
  reviewStats,
  comments,
  onReturnToDashboard,
  onLogout,
  timerStartTime,
  onTimerUpdate,
}) => {
  const documentViewer = useDocumentViewer(documents, documentContent);
  const codingState = useCodingState({
    initialPrimarySuggestions: primarySuggestions,
    initialSecondarySuggestions: secondarySuggestions,
    initialComments: comments,
    reviewStats,
    selectedEpisodeDocId,
  });
  const icdSearch = useICDSearch();
  const pdfSearch = usePdfSearch(selectedEpisodeDocId);
  const resizablePanel = useResizablePanel(50);

  // Local component state
  const [commentEditMode, setCommentEditMode] = useState(new Set<string>());
  const [tempComments, setTempComments] = useState<Record<string, string>>({});
  const [isAddingComment, setIsAddingComment] = useState(new Set<string>());
  const [cursorPositions, setCursorPositions] = useState<
    Record<string, number>
  >({});

  // Listen for escape key cancellation from PDFViewer
  useEffect(() => {
    const handleCancelICDAddition = () => {
      icdSearch.cancelICDAddition();
    };

    document.addEventListener("cancelICDAddition", handleCancelICDAddition);

    return () => {
      document.removeEventListener(
        "cancelICDAddition",
        handleCancelICDAddition
      );
    };
  }, [icdSearch]);

  // Listen for search highlight changes and navigate to them
  useEffect(() => {
    if (pdfSearch.currentSearchHighlight) {
      documentViewer.navigateToSearchMatch(pdfSearch.currentSearchHighlight);
    } else {
      documentViewer.clearSearchHighlight();
    }
  }, [pdfSearch.currentSearchHighlight, documentViewer]);

  const handleAreaSelected = (area: SelectedArea) => {
    icdSearch.setSelectedArea(area);
    icdSearch.setShowICDModal(true);
  };

  const submitNewICD = () => {
    if (
      icdSearch.selectedIcdCode &&
      icdSearch.codingReason.trim() &&
      icdSearch.selectedArea
    ) {
      const newCode: CodeSuggestionType = {
        id: Date.now().toString(),
        code: icdSearch.selectedIcdCode.code,
        description: icdSearch.selectedIcdCode.description,
        confidence: 1.0,
        hippsPoints: 0,
        isHippsContributor: false,
        status: "pending",
        isManuallyAdded: true,
        aiReasoning: `Manually added by coding staff. Reason: ${icdSearch.codingReason.trim()}`,
        supportingSentences: [
          {
            text: `Manually identified from ${icdSearch.selectedArea.document}, page ${icdSearch.selectedArea.page}`,
            document: icdSearch.selectedArea.document,
            page: icdSearch.selectedArea.page,
            id: `manual-${Date.now()}`,
            boundingBox: {
              x_min: icdSearch.selectedArea.x_min,
              y_min: icdSearch.selectedArea.y_min,
              x_max: icdSearch.selectedArea.x_max,
              y_max: icdSearch.selectedArea.y_max,
            },
          },
        ],
        addedTimestamp: new Date().toLocaleString(),
        location: icdSearch.selectedArea,
        order:
          icdSearch.selectedIcdType === "primary"
            ? codingState.primarySuggestions.length
            : codingState.secondarySuggestions.length,
      };

      if (icdSearch.selectedIcdType === "primary") {
        codingState.setPrimarySuggestions((prev) => [...prev, newCode]);
      } else {
        codingState.setSecondarySuggestions((prev) => [...prev, newCode]);
      }

      icdSearch.resetModalState();
    }
  };

  // Comment management functions
  const handleCommentChange = (
    key: string,
    value: string,
    cursorPosition: number
  ) => {
    setCursorPositions((prev) => ({ ...prev, [key]: cursorPosition }));
    setTempComments((prev) => ({ ...prev, [key]: value }));
  };

  const startAddingComment = (codeId: string) => {
    setIsAddingComment((prev) => new Set([...prev, codeId]));
    setTempComments((prev) => ({ ...prev, [`new-${codeId}`]: "" }));
  };

  const startEditingComment = (codeId: string, commentId: string) => {
    const commentKey = `edit-${codeId}-${commentId}`;
    setCommentEditMode((prev) => new Set([...prev, commentKey]));
    const existingComments = codingState.comments[codeId] || [];
    const commentToEdit = existingComments.find((c) => c.id === commentId);
    setTempComments((prev) => ({
      ...prev,
      [commentKey]: commentToEdit ? commentToEdit.text : "",
    }));
  };

  const submitNewComment = (codeId: string) => {
    const newCommentText = tempComments[`new-${codeId}`] || "";
    if (newCommentText.trim()) {
      const currentUser =
        localStorage.getItem("username")?.split("@")[0] || "User";
      const currentTimestamp = new Date().toISOString();

      const newComment = {
        id: Date.now().toString(),
        text: newCommentText.trim(),
        timestamp: currentTimestamp,
        user: currentUser,
      };

      codingState.setComments((prev) => ({
        ...prev,
        [codeId]: [...(prev[codeId] || []), newComment],
      }));
    }

    setIsAddingComment((prev) => {
      const newSet = new Set(prev);
      newSet.delete(codeId);
      return newSet;
    });
    setTempComments((prev) => {
      const newTemp = { ...prev };
      delete newTemp[`new-${codeId}`];
      return newTemp;
    });
  };

  const submitEditComment = (codeId: string, commentId: string) => {
    const commentKey = `edit-${codeId}-${commentId}`;
    const editedText = tempComments[commentKey] || "";

    if (editedText.trim()) {
      codingState.setComments((prev) => ({
        ...prev,
        [codeId]: (prev[codeId] || []).map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                text: editedText.trim(),
                timestamp: new Date().toISOString(), // Update timestamp when edited
              }
            : comment
        ),
      }));
    }

    setCommentEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(commentKey);
      return newSet;
    });
    setTempComments((prev) => {
      const newTemp = { ...prev };
      delete newTemp[commentKey];
      return newTemp;
    });
  };

  const cancelNewComment = (codeId: string) => {
    setIsAddingComment((prev) => {
      const newSet = new Set(prev);
      newSet.delete(codeId);
      return newSet;
    });
    setTempComments((prev) => {
      const newTemp = { ...prev };
      delete newTemp[`new-${codeId}`];
      return newTemp;
    });
  };

  const cancelEditComment = (codeId: string, commentId: string) => {
    const commentKey = `edit-${codeId}-${commentId}`;
    setCommentEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(commentKey);
      return newSet;
    });
    setTempComments((prev) => {
      const newTemp = { ...prev };
      delete newTemp[commentKey];
      return newTemp;
    });
  };

  // Filter codes based on active tab and search term
  const getFilteredCodes = () => {
    const allCodes = [
      ...codingState.primarySuggestions,
      ...codingState.secondarySuggestions,
    ];

    // Apply search filter first
    let filteredCodes = allCodes;
    if (codingState.searchTerm.length >= 2) {
      filteredCodes = allCodes.filter(
        (code) =>
          code.code
            .toLowerCase()
            .includes(codingState.searchTerm.toLowerCase()) ||
          code.description
            .toLowerCase()
            .includes(codingState.searchTerm.toLowerCase())
      );
    }

    // Apply tab filter
    switch (codingState.activeTab) {
      case "accepted":
        return filteredCodes.filter(
          (code) =>
            codingState.selectedCodes.has(code.id) && !code.isManuallyAdded
        );
      case "rejected":
        return filteredCodes.filter((code) =>
          codingState.rejectedCodes.has(code.id)
        );
      case "newly-added":
        return filteredCodes.filter((code) => code.isManuallyAdded);
      default:
        return filteredCodes;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      {/* Branded Header */}
      <BrandedHeader
        selectedEpisodeDocId={selectedEpisodeDocId}
        onReturnToDashboard={onReturnToDashboard}
        onLogout={onLogout || onReturnToDashboard}
        timerStartTime={timerStartTime}
        onTimerUpdate={onTimerUpdate}
      />

      {/* Main Content Area */}
      <div
        className="flex flex-1 overflow-hidden"
        ref={resizablePanel.containerRef}
      >
        {/* PDF Viewer Side */}
        <div
          className="bg-white border-r border-gray-200 flex flex-col"
          style={{ width: `${resizablePanel.leftPanelWidth}%` }}
        >
          {/* Document Controls Header */}
          <CodingHeader
            selectedEpisodeDocId={selectedEpisodeDocId}
            documents={documents}
            selectedDocument={documentViewer.selectedDocument}
            currentPage={documentViewer.currentPage}
            currentDocument={documentViewer.currentDocument}
            zoomLevel={documentViewer.zoomLevel}
            pageInputValue={documentViewer.pageInputValue}
            isEditingPage={documentViewer.isEditingPage}
            isTransitioning={documentViewer.isTransitioning}
            onDocumentChange={documentViewer.setSelectedDocument}
            onReturnToDashboard={onReturnToDashboard}
            onPageChange={documentViewer.goToPage}
            onZoomIn={documentViewer.handleZoomIn}
            onZoomOut={documentViewer.handleZoomOut}
            onZoomReset={documentViewer.handleZoomReset}
            onPageInputClick={documentViewer.handlePageInputClick}
            onPageInputChange={documentViewer.handlePageInputChange}
            onPageInputKeyPress={documentViewer.handlePageInputKeyPress}
            onPageInputBlur={documentViewer.handlePageInputBlur}
            // PDF Search props
            searchTerm={pdfSearch.searchTerm}
            onSearchTermChange={(term) => {
              console.log("CodingInterface: Search term change:", term); // Debug log
              pdfSearch.setSearchTerm(term);
            }}
            onSearchSubmit={() =>
              pdfSearch.performPdfSearch(pdfSearch.searchTerm)
            }
            searchResults={pdfSearch.searchResults}
            currentMatchIndex={pdfSearch.currentMatchIndex}
            totalMatches={pdfSearch.totalMatches}
            isSearching={pdfSearch.isSearching}
            searchError={pdfSearch.searchError}
            hasSearchResults={pdfSearch.hasResults}
            hasMultipleResults={pdfSearch.hasMultipleResults}
            isCurrentTermSearched={pdfSearch.isCurrentTermSearched}
            onNextMatch={pdfSearch.goToNextMatch}
            onPrevMatch={pdfSearch.goToPrevMatch}
            onClearSearch={pdfSearch.clearSearch}
          />

          {/* PDF Content */}
          <PDFViewer
            selectedDocument={documentViewer.selectedDocument}
            currentPage={documentViewer.currentPage}
            zoomLevel={documentViewer.zoomLevel}
            highlightedEvidence={documentViewer.highlightedEvidence}
            showHighlight={documentViewer.showHighlight}
            searchHighlight={documentViewer.searchHighlight}
            isAddingICD={icdSearch.isAddingICD}
            isTransitioning={documentViewer.isTransitioning}
            onAreaSelected={handleAreaSelected}
            imageRef={documentViewer.imageRef}
            documentContent={documentContent}
            allImagesLoaded={documentViewer.allImagesLoaded}
            onPageChange={documentViewer.handlePageChangeFromViewer}
            targetPage={documentViewer.targetPage}
          />
        </div>

        {/* Resizable Divider */}
        <div
          className="w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize transition-colors flex-shrink-0"
          onMouseDown={resizablePanel.startResizing}
        >
          <div className="h-full w-full flex items-center justify-center">
            <MoreHorizontal className="w-4 h-4 text-gray-500 rotate-90" />
          </div>
        </div>

        {/* Medical Suggestions Side */}
        <div
          className="bg-white flex flex-col"
          style={{ width: `${100 - resizablePanel.leftPanelWidth}%` }}
        >
          <MedicalSuggestionsPanel
            codingState={codingState}
            icdSearch={icdSearch}
            getFilteredCodes={getFilteredCodes}
            commentEditMode={commentEditMode}
            tempComments={tempComments}
            isAddingComment={isAddingComment}
            onStartAddingComment={startAddingComment}
            onStartEditingComment={startEditingComment}
            onSubmitNewComment={submitNewComment}
            onSubmitEditComment={submitEditComment}
            onCancelNewComment={cancelNewComment}
            onCancelEditComment={cancelEditComment}
            onCommentChange={handleCommentChange}
            onNavigateToEvidence={documentViewer.navigateToEvidence}
            onReturnToDashboard={onReturnToDashboard}
          />
        </div>

        {/* ICD Modal */}
        <ICDModal
          isOpen={icdSearch.showICDModal}
          selectedArea={icdSearch.selectedArea}
          icdSearchTerm={icdSearch.icdSearchTerm}
          setIcdSearchTerm={icdSearch.setIcdSearchTerm}
          selectedIcdType={icdSearch.selectedIcdType}
          setSelectedIcdType={icdSearch.setSelectedIcdType}
          codingReason={icdSearch.codingReason}
          setCodingReason={icdSearch.setCodingReason}
          selectedIcdCode={icdSearch.selectedIcdCode}
          filteredICDCodes={icdSearch.filteredICDCodes}
          isSearching={icdSearch.isSearching}
          searchError={icdSearch.searchError}
          hasUserSelection={icdSearch.hasUserSelection}
          onICDSelection={icdSearch.handleICDSelection}
          onSubmit={submitNewICD}
          onCancel={icdSearch.cancelICDAddition}
        />
      </div>
    </div>
  );
};
