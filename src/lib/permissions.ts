export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  category: 'Billing & Invoicing' | 'Retail POS' | 'Inventory & Products' | 'Customers & Suppliers' | 'Finance & Admin';
}

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  // Billing & Invoicing
  {
    key: 'view_invoices',
    label: 'View Wholesale Invoices',
    description: 'Can view wholesale contracts, customer bills, and dispatch orders',
    category: 'Billing & Invoicing',
  },
  {
    key: 'create_invoices',
    label: 'Create / Issue Invoices',
    description: 'Can draft and dispatch new wholesale invoices to corporate clients',
    category: 'Billing & Invoicing',
  },
  {
    key: 'edit_invoices',
    label: 'Edit Invoices',
    description: 'Can modify line items, quantities, rates, and customer details on existing bills',
    category: 'Billing & Invoicing',
  },
  {
    key: 'delete_invoices',
    label: 'Delete / Void Invoices',
    description: 'Can permanently delete or void invoices and reverse stock ledger',
    category: 'Billing & Invoicing',
  },
  {
    key: 'settle_invoices',
    label: 'Record Payments / Settle',
    description: 'Can record payments and mark wholesale invoices as settled / PAID',
    category: 'Billing & Invoicing',
  },

  // Retail POS
  {
    key: 'access_pos',
    label: 'Access Counter POS Register',
    description: 'Can operate POS register terminal and ring up sales',
    category: 'Retail POS',
  },
  {
    key: 'apply_discounts',
    label: 'Apply Counter Discounts',
    description: 'Can apply custom discounts to cart or produce items',
    category: 'Retail POS',
  },
  {
    key: 'void_receipts',
    label: 'Void POS Transactions',
    description: 'Can void or cancel completed retail checkout transactions',
    category: 'Retail POS',
  },

  // Inventory & Products
  {
    key: 'view_products',
    label: 'View Products & Produce',
    description: 'Can view the catalogue, stock on hand, and price rates',
    category: 'Inventory & Products',
  },
  {
    key: 'manage_products',
    label: 'Add & Edit Produce',
    description: 'Can create new items, edit descriptions, and assign categories',
    category: 'Inventory & Products',
  },
  {
    key: 'edit_prices',
    label: 'Edit Pricing Matrix',
    description: 'Can change retail prices and wholesale price tiers',
    category: 'Inventory & Products',
  },
  {
    key: 'delete_products',
    label: 'Delete Produce SKUs',
    description: 'Can remove produce items from the active catalogue',
    category: 'Inventory & Products',
  },
  {
    key: 'adjust_stock',
    label: 'Adjust Inventory & Cold Chain',
    description: 'Can adjust warehouse counts, report waste, spoil, or surplus',
    category: 'Inventory & Products',
  },

  // Customers & Suppliers
  {
    key: 'view_customers',
    label: 'View Customers Directory',
    description: 'Can view wholesale clients, retail shoppers, and balances',
    category: 'Customers & Suppliers',
  },
  {
    key: 'manage_customers',
    label: 'Manage Customer Accounts',
    description: 'Can register new clients and edit addresses and contact info',
    category: 'Customers & Suppliers',
  },
  {
    key: 'adjust_credit_limit',
    label: 'Approve Credit Limits',
    description: 'Can approve and modify B2B credit lines and commercial terms',
    category: 'Customers & Suppliers',
  },
  {
    key: 'view_vendors',
    label: 'View Suppliers & Vendors',
    description: 'Can view farm suppliers and purchase order histories',
    category: 'Customers & Suppliers',
  },
  {
    key: 'manage_pos_intake',
    label: 'Purchase Orders & Restock Intake',
    description: 'Can issue supplier POs and accept cold chain pallet deliveries',
    category: 'Customers & Suppliers',
  },

  // Finance & Admin
  {
    key: 'view_reports',
    label: 'Financial Analytics & Profit Margins',
    description: 'Can view real-time gross margin, profitability, and debt aging',
    category: 'Finance & Admin',
  },
  {
    key: 'manage_staff',
    label: 'Manage Staff Profiles',
    description: 'Can create staff accounts, update PINs, and change roles',
    category: 'Finance & Admin',
  },
  {
    key: 'manage_permissions',
    label: 'Configure Role & User Permissions',
    description: 'Can configure fine-grained permissions for staff members',
    category: 'Finance & Admin',
  },
  {
    key: 'view_logs',
    label: 'Audit Trail & Event Logs',
    description: 'Can inspect system audit trail and user access logs',
    category: 'Finance & Admin',
  },
];

export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ['*'], // Full wildcard access
  MANAGER: [
    'view_invoices',
    'create_invoices',
    'edit_invoices',
    'delete_invoices',
    'settle_invoices',
    'access_pos',
    'apply_discounts',
    'view_products',
    'manage_products',
    'edit_prices',
    'adjust_stock',
    'view_customers',
    'manage_customers',
    'adjust_credit_limit',
    'view_vendors',
    'manage_pos_intake',
    'view_reports',
    'manage_staff',
    'view_logs',
  ],
  SALES_REP: [
    'view_invoices',
    'create_invoices',
    'edit_invoices',
    'settle_invoices',
    'view_products',
    'view_customers',
    'manage_customers',
  ],
  CASHIER: [
    'access_pos',
    'apply_discounts',
    'view_products',
    'view_customers',
  ],
  INVENTORY_CLERK: [
    'view_products',
    'adjust_stock',
    'view_vendors',
    'manage_pos_intake',
  ],
  ACCOUNTANT: [
    'view_invoices',
    'settle_invoices',
    'view_customers',
    'view_vendors',
    'view_reports',
  ],
};

export function checkUserPermission(
  userRole: string,
  userPermissions: string[] | null | undefined,
  requiredPermission: string
): boolean {
  if (userRole === 'ADMIN') return true;
  if (userPermissions && userPermissions.includes('*')) return true;

  if (Array.isArray(userPermissions) && userPermissions.length > 0) {
    return userPermissions.includes(requiredPermission);
  }

  // Fallback to role defaults
  const defaults = ROLE_DEFAULT_PERMISSIONS[userRole] || [];
  return defaults.includes(requiredPermission);
}
