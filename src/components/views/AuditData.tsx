import { Package2, Calculator, FileCheck, AlertTriangle, RotateCcw, ShieldCheck, CheckSquare } from 'lucide-react';
import Heading from '../element/Heading';
import { useSheets } from '@/context/SheetsContext';
import { useEffect, useState, useMemo } from 'react';
import type { ColumnDef, Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useAuth } from '@/context/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { toast } from 'sonner';
import { postToSheet } from '@/lib/fetchers';
import { PuffLoader as Loader } from 'react-spinners';
import { Textarea } from '../ui/textarea';

// Define a type for sheet items
interface SheetItem {
  rowIndex: string;
  [key: string]: any;
}

// Helper function to get field value with multiple possible keys
const getFieldValue = (item: SheetItem | undefined | null, ...possibleKeys: string[]): any => {
  if (!item) return '';
  for (const key of possibleKeys) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
      return item[key];
    }
  }
  return '';
};

// Helper function to format date to dd/mm/yy
const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  try {
    const dateObj = new Date(dateString);
    if (isNaN(dateObj.getTime())) return dateString;
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = String(dateObj.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  } catch {
    return dateString;
  }
};

// Define Stage interface
interface StageConfig {
  name: string;
  plannedField?: string;
  actualField?: string;
  statusField?: string;
  remarksField?: string;
  color: string;
  icon: any;
  description: string;
  formTitle?: string;
  statusOptions?: string[];
}

// Define Stages object with proper typing
const STAGES: Record<string, StageConfig> = {
  AUDIT: { 
    name: 'Audit Data', 
    plannedField: 'planned1',
    actualField: 'actual1',
    statusField: 'status1',
    remarksField: 'remarks1',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: FileCheck,
    description: 'Initial audit verification',
    formTitle: 'Process Audit Data',
    statusOptions: ['Done', 'Not Done']
  },
  RECTIFY: { 
    name: 'Rectify Mistake', 
    plannedField: 'planned2',
    actualField: 'actual2',
    statusField: 'status2',
    remarksField: 'remarks 2',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: AlertTriangle,
    description: 'Correct mistakes and add bilty',
    formTitle: 'Rectify The Mistake',
    statusOptions: ['Done', 'Not Done']
  },
  REAUDIT: { 
    name: 'Reaudit Data', 
    plannedField: 'planned3',
    actualField: 'actual3',
    statusField: 'status3',
    remarksField: 'remarks 3',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: RotateCcw,
    description: 'Re-audit after corrections',
    formTitle: 'Reauditing Data',
    statusOptions: ['Done', 'Not Done']
  },
  TALLY_ENTRY: { 
    name: 'Tally Entry', 
    plannedField: 'planned4',
    actualField: 'actual4',
    statusField: 'status4',
    remarksField: 'remarks 4',
    color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    icon: Calculator,
    description: 'Enter data into tally system',
    formTitle: 'Tally Entry',
    statusOptions: ['Done', 'Not Done']
  },
  AGAIN_AUDIT: { 
    name: 'Again Auditing', 
    plannedField: 'planned5',
    actualField: 'actual5',
    statusField: 'status5',
    remarksField: 'remarks 5',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: ShieldCheck,
    description: 'Final audit verification',
    formTitle: 'Again Auditing',
    statusOptions: ['okey', 'not okey']
  },
  COMPLETED: { 
    name: 'Completed', 
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckSquare,
    description: 'All stages completed'
  }
};

// Update the ProcessedTallyData interface to include all remarks fields
interface ProcessedTallyData {
  rowIndex: string;
  indentNumber: string;
  indentDate: string;
  purchaseDate: string;
  materialInDate: string;
  plannedDate: string;
  productName: string;
  firmNameMatch: string;
  billNo: string;
  qty: number;
  partyName: string;
  billAmt: number;
  billImage: string;
  billReceivedLater: string;
  notReceivedBillNo: string;
  location: string;
  typeOfBills: string;
  productImage: string;
  area: string;
  indentedFor: string;
  approvedPartyName: string;
  rate: number;
  indentQty: number;
  totalRate: number;
  liftNumber: string;
  poNumber: string;
  currentStage: keyof typeof STAGES | string;
  isCompleted: boolean;
  
  // Add all remarks fields
  remarks1: string;
  remarks2: string;
  remarks3: string;
  remarks4: string;
  remarks5: string;
  
  // Add status fields for display
  status1: string;
  status2: string;
  status3: string;
  status4: string;
  status5: string;
}

// Define form values type
interface FormValues {
  status: string | undefined;
  remarks: string;
}

export default function PcReportTable() {
  const { tallyEntrySheet, poMasterLoading, updateAll } = useSheets();
  const [allData, setAllData] = useState<ProcessedTallyData[]>([]);
  const [selectedRow, setSelectedRow] = useState<ProcessedTallyData | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('ALL');

  // Process all data from sheet
  useEffect(() => {
    if (!tallyEntrySheet) return;
    
    console.log("🔍 Processing tally entry sheet data...");
    
    // Filter by firm name first
    const filteredByFirm = tallyEntrySheet.filter((item: SheetItem) => {
      const firmName = getFieldValue(item, 'Firm Name', 'firmName', 'firmNameMatch');
      return user.firmNameMatch.toLowerCase() === "all" || firmName === user.firmNameMatch;
    });
    
    console.log('✅ Filtered by firm:', filteredByFirm.length);
    
    // Process each item
    const processedData = filteredByFirm.map((item: SheetItem) => {
      // Get all stage fields
      const planned1 = getFieldValue(item, 'Planned 1', 'planned1');
      const actual1 = getFieldValue(item, 'Actual 1', 'actual1');
      const planned2 = getFieldValue(item, 'Planned 2', 'planned2');
      const actual2 = getFieldValue(item, 'Actual 2', 'actual2');
      const planned3 = getFieldValue(item, 'Planned 3', 'planned3');
      const actual3 = getFieldValue(item, 'Actual 3', 'actual3');
      const planned4 = getFieldValue(item, 'Planned 4', 'planned4');
      const actual4 = getFieldValue(item, 'Actual 4', 'actual4');
      const planned5 = getFieldValue(item, 'Planned 5', 'planned5');
      const actual5 = getFieldValue(item, 'Actual 5', 'actual5');

      // Helper function
      const hasValue = (value: any): boolean => {
        return value !== undefined && value !== null && value !== '' && String(value).trim() !== '';
      };

      // Determine current stage
      let currentStage: keyof typeof STAGES = 'AUDIT';
      let plannedDate = '';
      let isCompleted = false;

      if (hasValue(planned1) && !hasValue(actual1)) {
        currentStage = 'AUDIT';
        plannedDate = planned1;
      } else if (hasValue(planned2) && !hasValue(actual2)) {
        currentStage = 'RECTIFY';
        plannedDate = planned2;
      } else if (hasValue(planned3) && !hasValue(actual3)) {
        currentStage = 'REAUDIT';
        plannedDate = planned3;
      } else if (hasValue(planned4) && !hasValue(actual4)) {
        currentStage = 'TALLY_ENTRY';
        plannedDate = planned4;
      } else if (hasValue(planned5) && !hasValue(actual5)) {
        currentStage = 'AGAIN_AUDIT';
        plannedDate = planned5;
      } else if (hasValue(actual1) && hasValue(actual2) && hasValue(actual3) && hasValue(actual4) && hasValue(actual5)) {
        currentStage = 'COMPLETED';
        isCompleted = true;
        plannedDate = planned5 || planned4 || planned3 || planned2 || planned1;
      } else {
        return null;
      }

      const mapped: ProcessedTallyData = {
        rowIndex: item.rowIndex.toString(),
        indentNumber: getFieldValue(item, 'Indent Number', 'indentNumber', 'indentNo').toString().trim(),
        indentDate: getFieldValue(item, 'Indent Date', 'indentDate'),
        purchaseDate: getFieldValue(item, 'Purchase Date', 'purchaseDate'),
        materialInDate: getFieldValue(item, 'Material In Date', 'materialInDate'),
        plannedDate: plannedDate,
        productName: getFieldValue(item, 'Product Name', 'productName'),
        firmNameMatch: getFieldValue(item, 'Firm Name', 'firmName', 'firmNameMatch').toString().trim(),
        billNo: getFieldValue(item, 'Bill No.', 'Bill No', 'billNo').toString(),
        qty: Number(getFieldValue(item, 'Qty', 'qty')) || 0,
        partyName: getFieldValue(item, 'Party Name', 'partyName'),
        billAmt: Number(getFieldValue(item, 'Bill Amt', 'billAmt')) || 0,
        billImage: getFieldValue(item, 'Bill Image', 'billImage'),
        billReceivedLater: getFieldValue(item, 'Bill Recieved later', 'billReceivedLater'),
        notReceivedBillNo: getFieldValue(item, 'Not Received Bill No.', 'notReceivedBillNo'),
        location: getFieldValue(item, 'Location', 'location'),
        typeOfBills: getFieldValue(item, 'Type Of Bills', 'typeOfBills'),
        productImage: getFieldValue(item, 'Prodcut Image', 'Product Image', 'productImage'),
        area: getFieldValue(item, 'Area', 'area'),
        indentedFor: getFieldValue(item, 'Indented For', 'indentedFor'),
        approvedPartyName: getFieldValue(item, 'Approved Party Name', 'approvedPartyName'),
        rate: Number(getFieldValue(item, 'Rate', 'rate')) || 0,
        indentQty: Number(getFieldValue(item, 'Indent Qty', 'indentQty')) || 0,
        totalRate: Number(getFieldValue(item, 'Total Rate', 'totalRate')) || 0,
        liftNumber: getFieldValue(item, 'Lift Number', 'liftNumber'),
        poNumber: getFieldValue(item, 'PO Number', 'poNumber'),
        currentStage,
        isCompleted,
        
        // Add all remarks fields
        remarks1: getFieldValue(item, 'Remarks1', 'remarks1'),
        remarks2: getFieldValue(item, 'Remarks 2', 'remarks2'),
        remarks3: getFieldValue(item, 'Remarks 3', 'remarks3'),
        remarks4: getFieldValue(item, 'Remarks 4', 'remarks4'),
        remarks5: getFieldValue(item, 'Remarks 5', 'remarks5'),
        
        // Add status fields
        status1: getFieldValue(item, 'Status 1', 'status1'),
        status2: getFieldValue(item, 'Status 2', 'status2'),
        status3: getFieldValue(item, 'Status 3', 'status3'),
        status4: getFieldValue(item, 'Status 4', 'status4'),
        status5: getFieldValue(item, 'Status 5', 'status5'),
      };

      return mapped;
    }).filter((item): item is ProcessedTallyData => item !== null);

    console.log(`✅ Processed ${processedData.length} items`);
    console.log('📊 Stage distribution:', 
      processedData.reduce((acc, item) => {
        const stage = item.currentStage;
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    );
    
    setAllData(processedData);
  }, [tallyEntrySheet, user.firmNameMatch]);

  // Filter data based on active tab
  const filteredData = useMemo(() => {
    let filtered = allData;
    
    // Filter by stage if not "ALL" or "COMPLETED"
    if (activeTab === 'COMPLETED') {
      filtered = filtered.filter(item => item.isCompleted);
    } else if (activeTab !== 'ALL') {
      filtered = filtered.filter(item => 
        !item.isCompleted && item.currentStage === activeTab
      );
    } else {
      // ALL shows all pending items (not completed)
      filtered = filtered.filter(item => !item.isCompleted);
    }
    
    return filtered;
  }, [allData, activeTab]);

  // Get stage counts
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: allData.filter(item => !item.isCompleted).length,
      COMPLETED: allData.filter(item => item.isCompleted).length
    };

    ['AUDIT', 'RECTIFY', 'REAUDIT', 'TALLY_ENTRY', 'AGAIN_AUDIT'].forEach(stage => {
      counts[stage] = allData.filter(item => 
        !item.isCompleted && item.currentStage === stage
      ).length;
    });

    return counts;
  }, [allData]);

  // Get schema based on stage
  const formSchema = z.object({
  status: z.string().min(1, 'Please select a status'),
  remarks: z.string().min(1, 'Remarks are required'),
});

  const form = useForm<z.infer<typeof formSchema>>({
  resolver: zodResolver(formSchema),
  defaultValues: {
    status: '',
    remarks: '',
  },
});

  // Reset form when dialog closes
  useEffect(() => {
    if (!openDialog) {
      form.reset({ 
        status: undefined,
        remarks: '' 
      });
    }
  }, [openDialog, form]);

  // Handle item selection
 const handleItemSelect = (item: ProcessedTallyData) => {
  setSelectedRow(item);
  form.reset({
    status: '',
    remarks: '',
  });
  setOpenDialog(true);
};

  // Handle form submission
 async function onSubmit(values: z.infer<typeof formSchema>) {
  if (!selectedRow) {
    toast.error('No row selected!');
    return;
  }

    try {
      console.log('🔄 Starting form submission...');
      console.log('📝 Selected row:', selectedRow);
      console.log('📋 Form values:', values);

      // Get current date and time in dd/mm/yyyy hh:mm:ss format
      const currentDateTime = new Date()
        .toLocaleString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
        .replace(',', '');

      console.log('📅 Current date/time:', currentDateTime);

      // Find the exact row in the original sheet data
      const sheetRow = tallyEntrySheet?.find((s: SheetItem) => {
        const indentNumber = getFieldValue(s, 'Indent Number', 'indentNumber', 'indentNo').toString().trim();
        return indentNumber === selectedRow.indentNumber;
      });

      if (!sheetRow) {
        console.error('❌ Could not find matching row in sheet data');
        toast.error('Could not find matching record in sheet');
        return;
      }

      console.log('✅ Found sheet row:', sheetRow);
      console.log('📊 Row index:', sheetRow.rowIndex);

      // Get stage configuration
      const stageConfig = STAGES[selectedRow.currentStage];
      
      // Prepare update data with camelCase field names
      const updateData = [{
        rowIndex: sheetRow.rowIndex,
        [stageConfig.actualField || '']: currentDateTime,
        [stageConfig.statusField || '']: values.status,
        [stageConfig.remarksField || '']: values.remarks
      }];

      console.log('📤 Update data to send:', updateData);

      // Post to Google Sheet
      await postToSheet(updateData, 'update', 'TALLY ENTRY');

      console.log('✅ Update successful');
      toast.success(`Status updated for Indent ${selectedRow.indentNumber}`);

      // Close dialog and refresh data
      setOpenDialog(false);
      setTimeout(() => {
        updateAll();
        console.log('🔄 Data refreshed after update');
      }, 1500);

    } catch (err) {
      console.error('❌ Error in onSubmit:', err);
      toast.error('Failed to update status. Please try again.');
    }
  }

  function onError(errors: any) {
    console.log(errors);
    toast.error('Please fill all required fields');
  }

  // Columns for pending items (showing ALL columns like your Audit Data page)
  const pendingColumns: ColumnDef<ProcessedTallyData>[] = [
    {
      id: 'actions',
      header: 'Action',
      cell: ({ row }: { row: Row<ProcessedTallyData> }) => {
        const rowData = row.original;
        const stageInfo = STAGES[rowData.currentStage];
        const IconComponent = stageInfo?.icon;
        
        return (
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              onClick={() => handleItemSelect(rowData)}
              className="flex items-center gap-2"
            >
              {IconComponent && <IconComponent className="w-4 h-4" />}
              Process
            </Button>
          </DialogTrigger>
        );
      },
    },
    { 
      accessorKey: 'indentNumber', 
      header: 'Indent No.' 
    },
    { 
      accessorKey: 'currentStage',
      header: 'Current Stage',
      cell: ({ row }) => {
        const stage = row.original.currentStage;
        const stageInfo = STAGES[stage];
        
        return (
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${stageInfo?.color || 'bg-gray-100 text-gray-800'}`}>
            {stageInfo?.name}
          </span>
        );
      },
    },
    {
      accessorKey: 'liftNumber',
      header: 'Lift Number',
      cell: ({ row }) => row.original.liftNumber || ''
    },
    {
      accessorKey: 'poNumber',
      header: 'Po Number',
      cell: ({ row }) => row.original.poNumber || ''
    },
    {
      accessorKey: 'materialInDate',
      header: 'Material In Date',
      cell: ({ row }) => formatDate(row.original.materialInDate)
    },
    { 
      accessorKey: 'plannedDate', 
      header: 'Planned Date',
      cell: ({ row }) => formatDate(row.original.plannedDate)
    },
    { accessorKey: 'productName', header: 'Product Name' },
    { accessorKey: 'billNo', header: 'Bill No.' },
    { accessorKey: 'qty', header: 'Qty' },
    { accessorKey: 'partyName', header: 'Party Name' },
    { accessorKey: 'billAmt', header: 'Bill Amt' },
    {
      accessorKey: 'billImage',
      header: 'Bill Image',
      cell: ({ row }) => {
        const image = row.original.billImage;
        return image ? (
          <a href={image} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            View
          </a>
        ) : null;
      },
    },
    { accessorKey: 'billReceivedLater', header: 'Bill Received Later' },
    { accessorKey: 'notReceivedBillNo', header: 'Not Received Bill No.' },
    { accessorKey: 'location', header: 'Location' },
    { accessorKey: 'typeOfBills', header: 'Type Of Bills' },
    {
      accessorKey: 'productImage',
      header: 'Product Image',
      cell: ({ row }) => {
        const image = row.original.productImage;
        return image ? (
          <a href={image} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            View
          </a>
        ) : null;
      },
    },
    { accessorKey: 'area', header: 'Area' },
    { accessorKey: 'indentedFor', header: 'Indented For' },
    { accessorKey: 'approvedPartyName', header: 'Approved Party Name' },
    { accessorKey: 'rate', header: 'Rate' },
    { accessorKey: 'indentQty', header: 'Indent Qty' },
    { accessorKey: 'totalRate', header: 'Total Rate' },
    
    // Add status and remarks columns for each stage
    {
      accessorKey: 'status1',
      header: 'Audit Status',
      cell: ({ row }) => {
        const status = row.original.status1;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
            status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks1',
      header: 'Audit Remarks',
      cell: ({ row }) => {
        const remarks = row.original.remarks1;
        return remarks ? (
          <div className="max-w-xs truncate" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
    {
      accessorKey: 'status2',
      header: 'Rectify Status',
      cell: ({ row }) => {
        const status = row.original.status2;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
            status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks2',
      header: 'Rectify Remarks',
      cell: ({ row }) => {
        const remarks = row.original.remarks2;
        return remarks ? (
          <div className="max-w-xs truncate" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
    {
      accessorKey: 'status3',
      header: 'Reaudit Status',
      cell: ({ row }) => {
        const status = row.original.status3;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
            status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks3',
      header: 'Reaudit Remarks',
      cell: ({ row }) => {
        const remarks = row.original.remarks3;
        return remarks ? (
          <div className="max-w-xs truncate" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
    {
      accessorKey: 'status4',
      header: 'Tally Status',
      cell: ({ row }) => {
        const status = row.original.status4;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
            status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks4',
      header: 'Tally Remarks',
      cell: ({ row }) => {
        const remarks = row.original.remarks4;
        return remarks ? (
          <div className="max-w-xs truncate" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
    {
      accessorKey: 'status5',
      header: 'Again Audit Status',
      cell: ({ row }) => {
        const status = row.original.status5;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
            status === 'okey' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks5',
      header: 'Again Audit Remarks',
      cell: ({ row }) => {
        const remarks = row.original.remarks5;
        return remarks ? (
          <div className="max-w-xs truncate" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
  ];

  // Update completedColumns to show all status and remarks
  const completedColumns: ColumnDef<ProcessedTallyData>[] = [
    { 
      accessorKey: 'indentNumber', 
      header: 'Indent No.' 
    },
    { 
      accessorKey: 'firmNameMatch', 
      header: 'Firm Name' 
    },
    { 
      accessorKey: 'plannedDate', 
      header: 'Completed Date',
      cell: ({ row }) => formatDate(row.original.plannedDate)
    },
    { accessorKey: 'productName', header: 'Product Name' },
    { accessorKey: 'billNo', header: 'Bill No' },
    { accessorKey: 'qty', header: 'Quantity' },
    { accessorKey: 'partyName', header: 'Party Name' },
    { accessorKey: 'billAmt', header: 'Bill Amount' },
    {
      accessorKey: 'status1',
      header: 'Audit Status',
      cell: ({ row }) => {
        const status = row.original.status1;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
            status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks1',
      header: 'Audit Remarks',
      cell: ({ row }) => {
        const remarks = row.original.remarks1;
        return remarks ? (
          <div className="max-w-xs truncate" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
    {
      accessorKey: 'status2',
      header: 'Rectify Status',
      cell: ({ row }) => {
        const status = row.original.status2;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
            status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks2',
      header: 'Rectify Remarks',
      cell: ({ row }) => {
        const remarks = row.original.remarks2;
        return remarks ? (
          <div className="max-w-xs truncate" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
    {
      accessorKey: 'status3',
      header: 'Reaudit Status',
      cell: ({ row }) => {
        const status = row.original.status3;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
            status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks3',
      header: 'Reaudit Remarks',
      cell: ({ row }) => {
        const remarks = row.original.remarks3;
        return remarks ? (
          <div className="max-w-xs truncate" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
    {
      accessorKey: 'status4',
      header: 'Tally Status',
      cell: ({ row }) => {
        const status = row.original.status4;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
            status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks4',
      header: 'Tally Remarks',
      cell: ({ row }) => {
        const remarks = row.original.remarks4;
        return remarks ? (
          <div className="max-w-xs truncate" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
    {
      accessorKey: 'status5',
      header: 'Again Audit',
      cell: ({ row }) => {
        const status = row.original.status5;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
            status === 'okey' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks5',
      header: 'Again Audit Remarks',
      cell: ({ row }) => {
        const remarks = row.original.remarks5;
        return remarks ? (
          <div className="max-w-xs truncate" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
  ];

  // Stats data
  const statsData = [
    { title: 'Total Pending', value: stageCounts.ALL, color: 'text-gray-600' },
    { title: 'Audit', value: stageCounts.AUDIT, color: 'text-amber-600' },
    { title: 'Rectify', value: stageCounts.RECTIFY, color: 'text-blue-600' },
    { title: 'Reaudit', value: stageCounts.REAUDIT, color: 'text-purple-600' },
    { title: 'Tally Entry', value: stageCounts.TALLY_ENTRY, color: 'text-cyan-600' },
    { title: 'Again Auditing', value: stageCounts.AGAIN_AUDIT, color: 'text-orange-600' }
  ];

  return (
    <div>
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <Heading heading="Call Tracker" subtext="Track all stages of account processing">
          <Package2 size={50} className="text-primary" />
        </Heading>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          {statsData.map((stat, index) => (
            <div key={index} className="bg-white rounded-lg shadow-sm p-4 border">
              <p className="text-sm font-medium text-gray-500 mb-1">{stat.title}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="all" className="w-full">
          {/* Tabs Navigation */}
          <TabsList className="grid grid-cols-2 md:grid-cols-6 mb-6">
            <TabsTrigger value="all" onClick={() => setActiveTab('ALL')}>
              All Pending
            </TabsTrigger>
            <TabsTrigger value="audit" onClick={() => setActiveTab('AUDIT')}>
              Audit
            </TabsTrigger>
            <TabsTrigger value="rectify" onClick={() => setActiveTab('RECTIFY')}>
              Rectify
            </TabsTrigger>
            <TabsTrigger value="reaudit" onClick={() => setActiveTab('REAUDIT')}>
              Reaudit
            </TabsTrigger>
            <TabsTrigger value="tally" onClick={() => setActiveTab('TALLY_ENTRY')}>
              Tally Entry
            </TabsTrigger>
            <TabsTrigger value="again-audit" onClick={() => setActiveTab('AGAIN_AUDIT')}>
              Again Auditing
            </TabsTrigger>
            <TabsTrigger value="completed" onClick={() => setActiveTab('COMPLETED')}>
              Completed
            </TabsTrigger>
          </TabsList>

          {/* Tabs Content */}
          <TabsContent value="all">
            <DataTable
              data={filteredData}
              columns={pendingColumns}
              searchFields={['indentNumber', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
              dataLoading={poMasterLoading}
              className='h-[70dvh]'
            />
          </TabsContent>
          
          <TabsContent value="audit">
            <DataTable
              data={filteredData}
              columns={pendingColumns}
              searchFields={['indentNumber', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
              dataLoading={poMasterLoading}
              className='h-[70dvh]'
            />
          </TabsContent>
          
          <TabsContent value="rectify">
            <DataTable
              data={filteredData}
              columns={pendingColumns}
              searchFields={['indentNumber', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
              dataLoading={poMasterLoading}
              className='h-[70dvh]'
            />
          </TabsContent>
          
          <TabsContent value="reaudit">
            <DataTable
              data={filteredData}
              columns={pendingColumns}
              searchFields={['indentNumber', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
              dataLoading={poMasterLoading}
              className='h-[70dvh]'
            />
          </TabsContent>
          
          <TabsContent value="tally">
            <DataTable
              data={filteredData}
              columns={pendingColumns}
              searchFields={['indentNumber', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
              dataLoading={poMasterLoading}
              className='h-[70dvh]'
            />
          </TabsContent>
          
          <TabsContent value="again-audit">
            <DataTable
              data={filteredData}
              columns={pendingColumns}
              searchFields={['indentNumber', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
              dataLoading={poMasterLoading}
              className='h-[70dvh]'
            />
          </TabsContent>
          
          <TabsContent value="completed">
            <DataTable
              data={filteredData}
              columns={completedColumns}
              searchFields={['indentNumber', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
              dataLoading={poMasterLoading}
              className='h-[70dvh]'
            />
          </TabsContent>
        </Tabs>

        {selectedRow && (
          <DialogContent className="sm:max-w-2xl">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit, onError)}
                className="space-y-5"
              >
                <DialogHeader className="space-y-1">
                  <DialogTitle>
                    {STAGES[selectedRow.currentStage]?.formTitle || 'Update Status'}
                  </DialogTitle>
                  <DialogDescription>
                    Process entry for indent number{' '}
                    <span className="font-medium">{selectedRow.indentNumber}</span>
                    {' '}in{' '}
                    <span className="font-medium">{STAGES[selectedRow.currentStage]?.name}</span> stage
                  </DialogDescription>
                </DialogHeader>

                <div className="bg-gray-50 p-4 rounded-md grid gap-3">
                  <h3 className="text-lg font-bold">Entry Details</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-nowrap">Indent No.</p>
                      <p className="text-sm font-light">{selectedRow.indentNumber}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-nowrap">Firm Name</p>
                      <p className="text-sm font-light">{selectedRow.firmNameMatch}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-nowrap">Product Name</p>
                      <p className="text-sm font-light">{selectedRow.productName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Party Name</p>
                      <p className="text-sm font-light">{selectedRow.partyName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Bill No.</p>
                      <p className="text-sm font-light">{selectedRow.billNo}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Quantity</p>
                      <p className="text-sm font-light">{selectedRow.qty}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Bill Amount</p>
                      <p className="text-sm font-light">{selectedRow.billAmt}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Planned Date</p>
                      <p className="text-sm font-light">{formatDate(selectedRow.plannedDate)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status *</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedRow.currentStage === 'AGAIN_AUDIT' ? (
                                <>
                                  <SelectItem value="okey">Okey</SelectItem>
                                  <SelectItem value="not okey">Not Okey</SelectItem>
                                </>
                              ) : (
                                <>
                                  <SelectItem value="Done">Done</SelectItem>
                                  <SelectItem value="Not Done">Not Done</SelectItem>
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="remarks"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Remarks *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter remarks..."
                            {...field}
                            rows={4}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Close</Button>
                  </DialogClose>
                  
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && (
                      <Loader
                        size={20}
                        color="white"
                        aria-label="Loading Spinner"
                      />
                    )}
                    Update Status
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}