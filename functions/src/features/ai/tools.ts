/**
 * 12 farm management function declarations matching transfarm-app's
 * AIFunctionDeclarations. Allows the AI model to request farm data when needed.
 */
export const AI_FUNCTION_DECLARATIONS = [
  {
    name: "get_farm_expenses",
    description:
      "Get individual expense transaction details (date, amount, description, category) for a farm. Use this ONLY when user asks for specific transaction details or wants to see individual expenses. For totals and summaries, use get_expense_summary instead.",
    parameters: {
      type: "OBJECT",
      properties: {
        farm_id: { type: "STRING", description: "The unique identifier of the farm" },
        start_date: {
          type: "STRING",
          description: "Start date in ISO 8601 format (YYYY-MM-DD). Optional, defaults to current month start",
        },
        end_date: {
          type: "STRING",
          description: "End date in ISO 8601 format (YYYY-MM-DD). Optional, defaults to current month end",
        },
      },
      required: ["farm_id"],
    },
  },
  {
    name: "get_farm_income",
    description:
      "Get individual income transaction details (date, amount, description, category, crop type, buyer) for a farm. Use this ONLY when user asks for specific transaction details or wants to see individual income records. For totals and summaries, use get_income_summary instead.",
    parameters: {
      type: "OBJECT",
      properties: {
        farm_id: { type: "STRING", description: "The unique identifier of the farm" },
        start_date: {
          type: "STRING",
          description: "Start date in ISO 8601 format (YYYY-MM-DD). Optional, defaults to current month start",
        },
        end_date: {
          type: "STRING",
          description: "End date in ISO 8601 format (YYYY-MM-DD). Optional, defaults to current month end",
        },
      },
      required: ["farm_id"],
    },
  },
  {
    name: "get_expense_summary",
    description:
      "Get aggregated expense summary with total amount, transaction count, and category-wise breakdown with percentages. Use this for questions about total expenses, spending patterns, or category analysis. This is the PRIMARY function for expense queries.",
    parameters: {
      type: "OBJECT",
      properties: {
        farm_id: { type: "STRING", description: "The unique identifier of the farm" },
        start_date: {
          type: "STRING",
          description: "Start date in ISO 8601 format (YYYY-MM-DD). Optional, defaults to current month start",
        },
        end_date: {
          type: "STRING",
          description: "End date in ISO 8601 format (YYYY-MM-DD). Optional, defaults to current month end",
        },
      },
      required: ["farm_id"],
    },
  },
  {
    name: "get_income_summary",
    description:
      "Get aggregated income summary with total amount, transaction count, and category-wise breakdown with percentages. Use this for questions about total income, revenue patterns, or category analysis. This is the PRIMARY function for income queries.",
    parameters: {
      type: "OBJECT",
      properties: {
        farm_id: { type: "STRING", description: "The unique identifier of the farm" },
        start_date: {
          type: "STRING",
          description: "Start date in ISO 8601 format (YYYY-MM-DD). Optional, defaults to current month start",
        },
        end_date: {
          type: "STRING",
          description: "End date in ISO 8601 format (YYYY-MM-DD). Optional, defaults to current month end",
        },
      },
      required: ["farm_id"],
    },
  },
  {
    name: "get_labour_records",
    description:
      "Get individual labour records with worker name, date, hours worked, wage rate, total payment, and work description. Use this when user asks for specific labour details or wants to see individual worker records.",
    parameters: {
      type: "OBJECT",
      properties: {
        farm_id: { type: "STRING", description: "The unique identifier of the farm" },
        start_date: {
          type: "STRING",
          description: "Start date in ISO 8601 format (YYYY-MM-DD). Optional, defaults to current month start",
        },
        end_date: {
          type: "STRING",
          description: "End date in ISO 8601 format (YYYY-MM-DD). Optional, defaults to current month end",
        },
        worker_name: {
          type: "STRING",
          description: "Filter by specific worker name. Optional",
        },
      },
      required: ["farm_id"],
    },
  },
  {
    name: "get_labour_summary",
    description:
      "Get aggregated labour summary with total hours worked, total wages paid, number of workers, and worker-wise breakdown. Use this for questions about total labour costs, worker productivity, or labour analysis.",
    parameters: {
      type: "OBJECT",
      properties: {
        farm_id: { type: "STRING", description: "The unique identifier of the farm" },
        start_date: {
          type: "STRING",
          description: "Start date in ISO 8601 format (YYYY-MM-DD). Optional, defaults to current month start",
        },
        end_date: {
          type: "STRING",
          description: "End date in ISO 8601 format (YYYY-MM-DD). Optional, defaults to current month end",
        },
      },
      required: ["farm_id"],
    },
  },
  {
    name: "get_attendance_records",
    description:
      "Get daily attendance records showing which workers were present, absent, or on leave for specific dates. Includes worker names, dates, status (present/absent/leave), and any notes.",
    parameters: {
      type: "OBJECT",
      properties: {
        farm_id: { type: "STRING", description: "The unique identifier of the farm" },
        start_date: {
          type: "STRING",
          description: "Start date in ISO 8601 format (YYYY-MM-DD). Optional, defaults to current month start",
        },
        end_date: {
          type: "STRING",
          description: "End date in ISO 8601 format (YYYY-MM-DD). Optional, defaults to current month end",
        },
        worker_name: {
          type: "STRING",
          description: "Filter by specific worker name. Optional",
        },
      },
      required: ["farm_id"],
    },
  },
  {
    name: "get_attendance_summary",
    description:
      "Get aggregated attendance summary with total present days, absent days, leave days, and attendance percentage per worker. Use this for attendance analysis and worker reliability assessment.",
    parameters: {
      type: "OBJECT",
      properties: {
        farm_id: { type: "STRING", description: "The unique identifier of the farm" },
        start_date: {
          type: "STRING",
          description: "Start date in ISO 8601 format (YYYY-MM-DD). Optional, defaults to current month start",
        },
        end_date: {
          type: "STRING",
          description: "End date in ISO 8601 format (YYYY-MM-DD). Optional, defaults to current month end",
        },
      },
      required: ["farm_id"],
    },
  },
  {
    name: "get_tasks",
    description:
      "Get farm tasks with title, description, due date, priority (high/medium/low), status (pending/completed/overdue), assigned workers, and completion status. Use this when user asks about tasks, to-dos, or work assignments.",
    parameters: {
      type: "OBJECT",
      properties: {
        farm_id: { type: "STRING", description: "The unique identifier of the farm" },
        status: {
          type: "STRING",
          description: 'Filter by task status: "pending", "completed", "overdue", or "all". Optional, defaults to "all"',
        },
        priority: {
          type: "STRING",
          description: 'Filter by priority: "high", "medium", "low", or "all". Optional, defaults to "all"',
        },
        start_date: {
          type: "STRING",
          description: "Filter tasks with due date after this date (ISO 8601 format). Optional",
        },
        end_date: {
          type: "STRING",
          description: "Filter tasks with due date before this date (ISO 8601 format). Optional",
        },
      },
      required: ["farm_id"],
    },
  },
  {
    name: "get_tasks_summary",
    description:
      "Get aggregated task summary with total tasks, completed count, pending count, overdue count, completion rate, and priority-wise breakdown. Use this for task management overview and productivity analysis.",
    parameters: {
      type: "OBJECT",
      properties: {
        farm_id: { type: "STRING", description: "The unique identifier of the farm" },
      },
      required: ["farm_id"],
    },
  },
  {
    name: "get_notes",
    description:
      "Get farm notes and observations with title, content, date created, category/tags, and any attached metadata. Use this when user asks about notes, observations, reminders, or recorded information.",
    parameters: {
      type: "OBJECT",
      properties: {
        farm_id: { type: "STRING", description: "The unique identifier of the farm" },
        start_date: {
          type: "STRING",
          description: "Filter notes created after this date (ISO 8601 format). Optional",
        },
        end_date: {
          type: "STRING",
          description: "Filter notes created before this date (ISO 8601 format). Optional",
        },
        search_query: {
          type: "STRING",
          description: "Search for specific keywords in note title or content. Optional",
        },
      },
      required: ["farm_id"],
    },
  },
  {
    name: "get_budget_overview",
    description:
      "Get comprehensive budget overview including total income, total expenses, net profit/loss, budget vs actual comparison, and financial health indicators. Use this for financial analysis, budget planning, or profit/loss queries.",
    parameters: {
      type: "OBJECT",
      properties: {
        farm_id: { type: "STRING", description: "The unique identifier of the farm" },
        start_date: {
          type: "STRING",
          description: "Start date in ISO 8601 format (YYYY-MM-DD). Optional, defaults to current month start",
        },
        end_date: {
          type: "STRING",
          description: "End date in ISO 8601 format (YYYY-MM-DD). Optional, defaults to current month end",
        },
      },
      required: ["farm_id"],
    },
  },
];
