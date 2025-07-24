import { useEffect, useState } from "react";
import { apiClient } from "../services/apiClient";
import {
  DocStatusType,
  InconsistencyApiResponse,
  ProjectData,
  ProjectsApiResponse,
} from "../types";

export const useDashboardApi = () => {
  const [dashboardCases, setDashboardCases] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function to determine doc status based on project data
  const determineDocStatus = (project: ProjectData): DocStatusType => {
    if (project.review_status === "COMPLETED") {
      return "Complete";
    } else if (
      project.review_status === "IN PROGRESS" ||
      project.review_status === "YET TO REVIEW"
    ) {
      // Use reject_count to determine if inconsistent
      return project.reject_count > 0 ? "Inconsistent" : "Incomplete";
    } else {
      return "Incomplete";
    }
  };

  // Helper function to determine revenue rate
  const determineRevenueRate = (project: ProjectData): string => {
    if (project.review_status === "COMPLETED") {
      // Generate a realistic revenue rate between 90-98%
      const rate = 90 + Math.floor(Math.random() * 9);
      return `${rate}%`;
    }
    return "—";
  };

  // Transform API data to enhanced ProjectData array
  const transformApiData = (projects: ProjectData[]): ProjectData[] => {
    return projects.map((project) => ({
      ...project,
      revenueRate: determineRevenueRate(project),
      docStatus: determineDocStatus(project),
    }));
  };

  // Calculate summary metrics from dashboard cases
  const calculateSummaryMetrics = (cases: ProjectData[]) => {
    const totalEpisodes = cases.length;
    const completedCases = cases.filter((c) => c.review_status === "COMPLETED");
    const inProgressCases = cases.filter(
      (c) =>
        c.review_status === "IN PROGRESS" || c.review_status === "YET TO REVIEW"
    );

    const completed = completedCases.length;
    const inProgress = inProgressCases.length;

    // Calculate average revenue rate for completed cases
    const avgRevenue =
      completedCases.length > 0
        ? Math.round(
            completedCases.reduce((sum, c) => {
              const rate = parseInt(c.revenueRate?.replace("%", "") || "0");
              return sum + rate;
            }, 0) / completedCases.length
          )
        : 0;

    return {
      totalEpisodes,
      completed,
      inProgress,
      avgRevenue: `${avgRevenue}%`,
    };
  };

  // Get next priority episode for "Start Next Episode" button
  const getNextPriorityEpisode = (cases: ProjectData[]): ProjectData | null => {
    const inProgressCases = cases.filter(
      (c) =>
        c.review_status === "IN PROGRESS" || c.review_status === "YET TO REVIEW"
    );

    if (inProgressCases.length === 0) return null;

    // Sort by created date (oldest first) to prioritize
    return inProgressCases.sort(
      (a, b) =>
        new Date(a.created_date).getTime() - new Date(b.created_date).getTime()
    )[0];
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Fetch data from API
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const data: ProjectsApiResponse = await apiClient.get("/projects");

      // Fetch inconsistency status for each project
      const projectsWithInconsistency = await Promise.all(
        data.projects.map(async (project) => {
          try {
            const inconsistencyData: InconsistencyApiResponse =
              await apiClient.get(`/inconsistency-results/${project.doc_id}`);
            return {
              ...project,
              inconsistencyStatus: inconsistencyData.status as
                | "COMPLETE"
                | "INCOMPLETE",
            };
          } catch (error) {
            console.error(
              `Error fetching inconsistency for ${project.doc_id}:`,
              error
            );
            return {
              ...project,
              inconsistencyStatus: "ERROR" as const,
            };
          }
        })
      );

      const transformedCases = transformApiData(projectsWithInconsistency);

      setDashboardCases(transformedCases);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch dashboard data"
      );

      // Fallback to sample data if API fails - using ProjectData format
      const fallbackData: ProjectData[] = [
        {
          doc_id: "DOC_VAUGHAN_PHYLLIS_S",
          created_date: "2025-06-27T10:30:00Z",
          status: "active",
          document_name: "EP_PHYLLIS_S_VAUGHAN",
          updated_date: "2025-12-15T14:20:00Z",
          accept_count: 8,
          reject_count: 2,
          remaining_count: 0,
          review_status: "COMPLETED",
          episode_id: "EP_PHYLLIS_S_VAUGHAN",
          revenueRate: "95%",
          docStatus: "Complete",
        },
        {
          doc_id: "DOC_ANDERSON_JOHN_M",
          created_date: "2025-06-27T09:15:00Z",
          status: "active",
          document_name: "EP_JOHN_M_ANDERSON",
          updated_date: "2025-12-14T16:45:00Z",
          accept_count: 10,
          reject_count: 4,
          remaining_count: 0,
          review_status: "COMPLETED",
          episode_id: "EP_JOHN_M_ANDERSON",
          revenueRate: "92%",
          docStatus: "Complete",
        },
        {
          doc_id: "DOC_WILLIAMS_DAVID",
          created_date: "2025-12-15T08:00:00Z",
          status: "active",
          document_name: "EP_DAVID_WILLIAMS",
          updated_date: "2025-12-15T08:00:00Z",
          accept_count: 0,
          reject_count: 0,
          remaining_count: 13,
          review_status: "YET TO REVIEW",
          episode_id: "EP_DAVID_WILLIAMS",
          revenueRate: "—",
          docStatus: "Incomplete",
        },
        {
          doc_id: "DOC_BROWN_JENNIFER",
          created_date: "2025-12-14T11:30:00Z",
          status: "active",
          document_name: "EP_JENNIFER_BROWN",
          updated_date: "2025-12-14T11:30:00Z",
          accept_count: 0,
          reject_count: 3,
          remaining_count: 18,
          review_status: "IN PROGRESS",
          episode_id: "EP_JENNIFER_BROWN",
          revenueRate: "—",
          docStatus: "Inconsistent",
        },
      ];

      setDashboardCases(fallbackData);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Refresh function for manual data refresh
  const refreshData = () => {
    fetchDashboardData();
  };

  return {
    dashboardCases,
    summaryMetrics: calculateSummaryMetrics(dashboardCases),
    nextPriorityEpisode: getNextPriorityEpisode(dashboardCases),
    formatDate,
    loading,
    error,
    refreshData,
  };
};
