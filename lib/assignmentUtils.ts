/**
 * Utility functions for assignment management
 */

/**
 * Check if an assignment is overdue
 */
export function isAssignmentOverdue(dueDate: string | Date | null): boolean {
  if (!dueDate) return false;
  const date = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  return date.getTime() < Date.now();
}

/**
 * Check if submissions are allowed for an assignment
 */
export function canSubmitAssignment(dueDate: string | Date | null): boolean {
  if (!dueDate) return true; // No due date means always open
  return !isAssignmentOverdue(dueDate);
}

/**
 * Get assignment status
 */
export function getAssignmentStatus(dueDate: string | Date | null): 'open' | 'due-soon' | 'due-today' | 'overdue' {
  if (!dueDate) return 'open';
  
  const date = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffTime < 0) return 'overdue';
  if (diffDays === 0) return 'due-today';
  if (diffDays <= 3) return 'due-soon';
  return 'open';
}

/**
 * Sort assignments by due date (overdue and due soon first)
 */
export function sortAssignmentsByDueDate(assignments: any[]): any[] {
  return [...assignments].sort((a, b) => {
    const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity;
    const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity;
    
    const now = Date.now();
    const aOverdue = aDate < now;
    const bOverdue = bDate < now;
    
    // Overdue assignments first
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    
    // Then sort by date (earliest first)
    return aDate - bDate;
  });
}
