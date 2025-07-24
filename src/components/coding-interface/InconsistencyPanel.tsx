import {
  Calendar,
  CheckCircle,
  ExternalLink,
  FileText,
  MessageSquare,
  User,
  XCircle,
} from "lucide-react";
import React from "react";
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
          // Incomplete status - show coordination note and supporting sentences
          <div className="flex flex-col h-full">
            {/* Reasoning Section - Top 1/3 */}
            <div
              className="border-b border-gray-200 p-4"
              style={{ minHeight: "33%" }}
            >
              <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-orange-600" />
                Reasoning
              </h3>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm font-medium text-orange-800 leading-relaxed">
                  {Array.isArray(results)
                    ? "No reasoning available"
                    : results.reasoning}
                </p>
              </div>
            </div>

            {/* Coordination Note - Top 1/3 */}
            <div
              className="border-b border-gray-200 p-4"
              style={{ minHeight: "33%" }}
            >
              <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-orange-600" />
                Coordination Note
              </h3>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm font-medium text-orange-800 leading-relaxed">
                  {Array.isArray(results)
                    ? "No coordination note available"
                    : results.coordination_note}
                </p>
              </div>

              {/* Additional Info */}
              {!Array.isArray(results) && (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs font-semibold text-gray-600 mb-1">
                      Coding Ready
                    </div>
                    <div
                      className={`flex items-center gap-1 ${
                        results.coding_ready ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {results.coding_ready ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      <span className="text-sm font-bold">
                        {results.coding_ready ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs font-semibold text-gray-600 mb-1">
                      Supporting Evidence
                    </div>
                    <div className="text-sm font-bold text-gray-800">
                      {results.supporting_sentences?.length || 0} items
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Supporting Sentences - Bottom 2/3 */}
            <div className="flex-1 p-4 overflow-auto">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Supporting Evidence
              </h3>

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
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span className="font-medium">
                            DOS: {sentence.dos}
                          </span>
                        </div>
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
        )}
      </div>
    </div>
  );
};
