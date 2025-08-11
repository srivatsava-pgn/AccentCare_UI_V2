import {
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  MessageSquare,
  User,
  XCircle,
} from "lucide-react";
import React, { useState } from "react";
import {
  InconsistencyApiResponse,
  InconsistencySupportingSentence,
} from "../../types";

interface InconsistencyPanelProps {
  selectedEpisodeDocId: string;
  inconsistencyResult: InconsistencyApiResponse | null;
  onNavigateToEvidence: (evidence: any) => void;
  onReturnToDashboard: () => void;
}

export const InconsistencyPanel: React.FC<InconsistencyPanelProps> = ({
  selectedEpisodeDocId,
  inconsistencyResult,
  onNavigateToEvidence,
  onReturnToDashboard,
}) => {
  // State for main sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set()); // All sections collapsed by default
  
  // State for coordination note accordion items
  const [expandedCoordinationItems, setExpandedCoordinationItems] = useState<Set<number>>(new Set([0])); // First coordination note expanded by default

  // Helper function to convert bbox array to BoundingBox
  const convertBboxToBoundingBox = (
    bbox: number[][][]
  ): { x_min: number; y_min: number; x_max: number; y_max: number } => {
    if (!bbox || bbox.length === 0 || !bbox[0] || bbox[0].length !== 8) {
      console.warn(
        "Invalid bbox array, expected nested array with 8 elements:",
        bbox
      );
      return { x_min: 0, y_min: 0, x_max: 1, y_max: 1 };
    }

    // bbox[0] = [min_x, min_y, max_x, min_y, max_x, max_y, min_x, max_y]
    const bboxArray = bbox[0];
    const xCoords = [bboxArray[0], bboxArray[2], bboxArray[4], bboxArray[6]];
    const yCoords = [bboxArray[1], bboxArray[3], bboxArray[5], bboxArray[7]];

    return {
      x_min: Math.min(...xCoords),
      y_min: Math.min(...yCoords),
      x_max: Math.max(...xCoords),
      y_max: Math.max(...yCoords),
    };
  };

  const handleSentenceClick = (sentence: InconsistencySupportingSentence) => {
    const evidence = {
      document: sentence.source_document_name,
      page: sentence.page_number,
      id: `inconsistency-${sentence.source_document_name}-${sentence.page_number}`,
      boundingBox: convertBboxToBoundingBox(sentence.bbox),
    };
    onNavigateToEvidence(evidence);
  };

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionName)) {
        newSet.delete(sectionName);
      } else {
        newSet.add(sectionName);
      }
      return newSet;
    });
  };

  const toggleCoordinationItem = (index: number) => {
    setExpandedCoordinationItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  if (!inconsistencyResult) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">
              Inconsistency Review
            </h2>
            <button
              onClick={onReturnToDashboard}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-lg font-semibold text-gray-700">
              Loading inconsistency data...
            </p>
          </div>
        </div>
      </div>
    );
  }

  const results = inconsistencyResult.results;
  const isComplete = inconsistencyResult.status === "COMPLETE";
  const isNotReady = inconsistencyResult.status === "NOT_READY";

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        {isComplete ? (
          // Complete status - show simple message
          <div className="p-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Review Complete
            </h3>
            <p className="text-gray-600 font-medium">
              This episode has passed all inconsistency checks and is ready for
              coding.
            </p>
          </div>
        ) : (
          // Incomplete or Not Ready status - show detailed information
          <div className="flex flex-col h-full">
            {/* Status Header */}
            <div className="border-b border-gray-200 p-4">
              <div className="flex items-center gap-3 mb-2">
                {isNotReady ? (
                  <XCircle className="w-6 h-6 text-red-600" />
                ) : (
                  <MessageSquare className="w-6 h-6 text-orange-600" />
                )}
                <h2 className="text-lg font-bold text-gray-800">
                  {isNotReady ? "Not Ready for Coding" : "Inconsistency Review"}
                </h2>
              </div>
              <div className={`inline-flex px-3 py-1 rounded-full text-sm font-bold ${
                isNotReady 
                  ? "bg-red-100 text-red-800" 
                  : "bg-orange-100 text-orange-800"
              }`}>
                Status: {inconsistencyResult.status.replace('_', ' ')}
              </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* Reasoning Section - Collapsible */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('reasoning')}
                  className="w-full flex items-center justify-between p-4 bg-orange-50 hover:bg-orange-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-5 h-5 text-orange-600" />
                    <h3 className="text-base font-bold text-gray-800">Reasoning</h3>
                  </div>
                  {expandedSections.has('reasoning') ? (
                    <ChevronUp className="w-5 h-5 text-orange-600 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-orange-600 flex-shrink-0" />
                  )}
                </button>
                
                {expandedSections.has('reasoning') && (
                  <div className="p-4 bg-white border-t border-orange-200">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      {Array.isArray(results) || !results.reasoning ? (
                        <p className="text-sm font-medium text-orange-800 leading-relaxed">
                          No reasoning available
                        </p>
                      ) : (
                        <div className="text-sm font-medium text-orange-800 leading-relaxed whitespace-pre-wrap">
                          {results.reasoning}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Coordination Notes Section - Collapsible */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('coordination')}
                  className="w-full flex items-center justify-between p-4 bg-orange-50 hover:bg-orange-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-5 h-5 text-orange-600" />
                    <h3 className="text-base font-bold text-gray-800">Coordination Notes</h3>
                  </div>
                  {expandedSections.has('coordination') ? (
                    <ChevronUp className="w-5 h-5 text-orange-600 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-orange-600 flex-shrink-0" />
                  )}
                </button>
                
                {expandedSections.has('coordination') && (
                  <div className="p-4 bg-white border-t border-orange-200">
                    {Array.isArray(results) || !results.coordination_note ? (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-orange-800 leading-relaxed">
                          No coordination notes available
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {typeof results.coordination_note === 'object' && !Array.isArray(results.coordination_note) ? (
                          Object.entries(results.coordination_note).map(([key, value], index) => (
                            <div key={index} className="border border-orange-200 rounded-lg overflow-hidden">
                              {/* Coordination Note Accordion Header */}
                              <button
                                onClick={() => toggleCoordinationItem(index)}
                                className="w-full flex items-center justify-between p-3 bg-orange-50 hover:bg-orange-100 transition-colors text-left"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-orange-800">
                                    {key}
                                  </span>
                                </div>
                                {expandedCoordinationItems.has(index) ? (
                                  <ChevronUp className="w-4 h-4 text-orange-600 flex-shrink-0" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-orange-600 flex-shrink-0" />
                                )}
                              </button>
                              
                              {/* Coordination Note Accordion Content */}
                              {expandedCoordinationItems.has(index) && (
                                <div className="p-4 bg-white border-t border-orange-200">
                                  <p className="text-sm font-medium text-orange-800 leading-relaxed">
                                    {value}
                                  </p>
                                </div>
                              )}
                            </div>
                          ))
                        ) : Array.isArray(results.coordination_note) ? (
                          // Backward compatibility for array format
                          results.coordination_note.map((note, index) => (
                            <div key={index} className="border border-orange-200 rounded-lg overflow-hidden">
                              {/* Coordination Note Accordion Header */}
                              <button
                                onClick={() => toggleCoordinationItem(index)}
                                className="w-full flex items-center justify-between p-3 bg-orange-50 hover:bg-orange-100 transition-colors text-left"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-orange-800">
                                    Coordination Note {index + 1}
                                  </span>
                                  <span className="text-xs bg-orange-200 text-orange-700 px-2 py-1 rounded-full font-medium">
                                    {note.length > 50 ? `${note.substring(0, 50)}...` : note.substring(0, 50)}
                                  </span>
                                </div>
                                {expandedCoordinationItems.has(index) ? (
                                  <ChevronUp className="w-4 h-4 text-orange-600 flex-shrink-0" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-orange-600 flex-shrink-0" />
                                )}
                              </button>
                              
                              {/* Coordination Note Accordion Content */}
                              {expandedCoordinationItems.has(index) && (
                                <div className="p-4 bg-white border-t border-orange-200">
                                  <p className="text-sm font-medium text-orange-800 leading-relaxed">
                                    {note}
                                  </p>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          // Single coordination note (backward compatibility)
                          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                            <p className="text-sm font-medium text-orange-800 leading-relaxed">
                              {results.coordination_note}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                )}
              </div>

              {/* Supporting Evidence Section - Always Visible */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="p-4 bg-blue-50 border-b border-blue-200">
                  <h3 className="text-base font-bold text-gray-800 flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-600" />
                    Supporting Evidence
                  </h3>
                </div>
                
                <div className="p-4 bg-white">
                  {Array.isArray(results) || !results.supporting_sentences ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p className="font-semibold">
                        No supporting evidence available
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {results.supporting_sentences.map((sentence, index) => (
                        <div
                          key={index}
                          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => handleSentenceClick(sentence)}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                              <span className="font-semibold text-gray-800 text-sm">
                                {sentence.source_document_name}
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSentenceClick(sentence);
                              }}
                              className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-xs font-semibold transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View
                            </button>
                          </div>

                          <div className="mb-3">
                            <p className="text-sm text-gray-700 font-medium leading-relaxed">
                              {sentence.sentence}
                            </p>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            {sentence.dos && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span className="font-medium">
                                  DOS: {sentence.dos}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              <span className="font-medium">
                                Page {sentence.page_number}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span className="font-medium">
                                Section: {sentence.section}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};