import { Package2 } from 'lucide-react';
import Heading from '../element/Heading';
import { useSheets } from '@/context/SheetsContext';
import { useEffect, useState } from 'react';
import type { ColumnDef, Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import type { TallyEntrySheet } from '@/types';
import { useAuth } from '@/context/AuthContext';

import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
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

// Helper function to get field value with multiple possible keys
const getFieldValue = (item: any, ...possibleKeys: string[]): any => {
  for (const key of possibleKeys) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
      return item[key];
    }
  }
  return '';
};

// Helper function to format date to dd/mm/yy
const formatDate = (dateString: string) => {
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

interface ProcessedTallyData {
  rowIndex: string;
  indentNo: string;
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
}

export default function PcReportTable() {
  const { tallyEntrySheet, poMasterLoading, updateAll } = useSheets();
  const [data, setData] = useState<ProcessedTallyData[]>([]);
  const [selectedRow, setSelectedRow] = useState<ProcessedTallyData | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const { user } = useAuth();

  // Update table data whenever tallyEntrySheet changes
  useEffect(() => {
    if (!tallyEntrySheet) return;
    
    console.log("🔍 Raw Tally Entry Sheet:", tallyEntrySheet);
    if (tallyEntrySheet.length > 0) {
      console.log('📋 First item keys:', Object.keys(tallyEntrySheet[0]));
      console.log('📋 First item sample:', tallyEntrySheet[0]);
    }
    
    // Filter by firm name first
    const filteredByFirm = tallyEntrySheet.filter(item => {
      const firmName = getFieldValue(item, 'Firm Name', 'firmName', 'firmNameMatch');
      return user.firmNameMatch.toLowerCase() === "all" || firmName === user.firmNameMatch;
    });
    
    console.log('✅ Filtered by firm:', filteredByFirm.length);
    
    // Filter the data according to planned5 has value and actual5 is empty/null
    const filteredData = filteredByFirm
      .filter((row) => {
        const planned5 = getFieldValue(row, 'Planned 5', 'planned5');
        const actual5 = getFieldValue(row, 'Actual 5', 'actual5');
        return planned5 !== '' && actual5 === '';
      })
      .map((i) => {
        const mapped = {
          rowIndex: i.rowIndex,
          indentNo: getFieldValue(i, 'Indent Number', 'indentNumber', 'indentNo').toString().trim(),
          indentDate: getFieldValue(i, 'Indent Date', 'indentDate'),
          purchaseDate: getFieldValue(i, 'Purchase Date', 'purchaseDate'),
          materialInDate: getFieldValue(i, 'Material In Date', 'materialInDate'),
          plannedDate: getFieldValue(i, 'Planned 5', 'planned5'),
          productName: getFieldValue(i, 'Product Name', 'productName'),
          firmNameMatch: getFieldValue(i, 'Firm Name', 'firmName', 'firmNameMatch').toString().trim(),
          billNo: getFieldValue(i, 'Bill No.', 'Bill No', 'billNo').toString(),
          qty: Number(getFieldValue(i, 'Qty', 'qty')) || 0,
          partyName: getFieldValue(i, 'Party Name', 'partyName'),
          billAmt: Number(getFieldValue(i, 'Bill Amt', 'billAmt')) || 0,
          billImage: getFieldValue(i, 'Bill Image', 'billImage'),
          billReceivedLater: getFieldValue(i, 'Bill Recieved later', 'billReceivedLater'),
          notReceivedBillNo: getFieldValue(i, 'Not Received Bill No.', 'notReceivedBillNo'),
          location: getFieldValue(i, 'Location', 'location'),
          typeOfBills: getFieldValue(i, 'Type Of Bills', 'typeOfBills'),
          productImage: getFieldValue(i, 'Prodcut Image', 'Product Image', 'productImage'),
          area: getFieldValue(i, 'Area', 'area'),
          indentedFor: getFieldValue(i, 'Indented For', 'indentedFor'),
          approvedPartyName: getFieldValue(i, 'Approved Party Name', 'approvedPartyName'),
          rate: Number(getFieldValue(i, 'Rate', 'rate')) || 0,
          indentQty: Number(getFieldValue(i, 'Indent Qty', 'indentQty')) || 0,
          totalRate: Number(getFieldValue(i, 'Total Rate', 'totalRate')) || 0,
        };
        console.log('📝 Mapped item:', mapped);
        return mapped;
      });

    console.log("✅ Final Filtered Data:", filteredData);
    setData(filteredData);
  }, [tallyEntrySheet, user.firmNameMatch]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!openDialog) {
      form.reset({ status: undefined });
    }
  }, [openDialog]);

  // Validation schema
  const schema = z.object({
  status: z.enum(['okey', 'not okey']),
});

const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
  defaultValues: {
    status: 'okey', // or 'not okey'
  },
});

  // Handle form submission
  async function onSubmit(values: z.infer<typeof schema>) {
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

      console.log('📅 Actual 5 date:', currentDateTime);

      // Find the exact row in the original sheet data
      const sheetRow = tallyEntrySheet.find((s) => {
        const indentNumber = getFieldValue(s, 'Indent Number', 'indentNumber', 'indentNo').toString().trim();
        return indentNumber === selectedRow.indentNo;
      });

      if (!sheetRow) {
        console.error('❌ Could not find matching row in sheet data');
        toast.error('Could not find matching record in sheet');
        return;
      }

      console.log('✅ Found sheet row:', sheetRow);
      console.log('📊 Row index:', sheetRow.rowIndex);

      // Prepare update data with camelCase field names
      const updateData = [{
        rowIndex: sheetRow.rowIndex,
        actual5: currentDateTime,
        status5: values.status,
      }];

      console.log('📤 Update data to send:', updateData);

      // Post to Google Sheet
      await postToSheet(updateData, 'update', 'TALLY ENTRY');

      console.log('✅ Update successful');
      toast.success(`Status updated for Indent ${selectedRow.indentNo}`);

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

  function onError(e: any) {
    console.log(e);
    toast.error('Please fill all required fields');
  }

  // Columns for TallyEntrySheet
  const columns: ColumnDef<ProcessedTallyData>[] = [
    {
      id: 'actions',
      header: 'Action',
      cell: ({ row }: { row: Row<ProcessedTallyData> }) => {
        const rowData = row.original;
        return (
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              onClick={() => {
                setSelectedRow(rowData);
              }}
            >
              Action
            </Button>
          </DialogTrigger>
        );
      },
    },
    { 
      accessorKey: 'indentNo', 
      header: 'Indent Number' 
    },
    { 
      accessorKey: 'indentDate', 
      header: 'Indent Date',
      cell: ({ row }) => formatDate(row.original.indentDate)
    },
    { 
      accessorKey: 'purchaseDate', 
      header: 'Purchase Date',
      cell: ({ row }) => formatDate(row.original.purchaseDate)
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
    { accessorKey: 'firmNameMatch', header: 'Firm Name' }, 
    { accessorKey: 'billNo', header: 'Bill No' },
    { accessorKey: 'qty', header: 'Quantity' },
    { accessorKey: 'partyName', header: 'Party Name' },
    { accessorKey: 'billAmt', header: 'Bill Amount' },
    {
      accessorKey: 'billImage',
      header: 'Bill Image',
      cell: ({ row }) => {
        const image = row.original.billImage;
        return image ? (
          <a 
            href={image} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-blue-600 hover:underline"
          >
            View
          </a>
        ) : null;
      },
    },
    { accessorKey: 'billReceivedLater', header: 'Bill Received Later' },
    { accessorKey: 'notReceivedBillNo', header: 'Not Received Bill No' },
    { accessorKey: 'location', header: 'Location' },
    { accessorKey: 'typeOfBills', header: 'Type Of Bills' },
    {
      accessorKey: 'productImage',
      header: 'Product Image',
      cell: ({ row }) => {
        const image = row.original.productImage;
        return image ? (
          <a 
            href={image} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-blue-600 hover:underline"
          >
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
  ];

  return (
    <div>
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <Heading heading="Again Auditing" subtext="Process and update tally entries">
          <Package2 size={50} className="text-primary" />
        </Heading>

        <DataTable
          data={data}
          columns={columns}
          searchFields={['indentNo', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
          dataLoading={poMasterLoading}
          className='h-[80dvh]'
        />

        {selectedRow && (
          <DialogContent className="sm:max-w-2xl">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit, onError)}
                className="space-y-5"
              >
                <DialogHeader>
                  <DialogTitle>
                    Update Status for Indent {selectedRow.indentNo}
                  </DialogTitle>
                </DialogHeader>

                <div className="bg-muted p-4 rounded-md grid gap-3">
                  <h3 className="text-lg font-bold">Entry Details</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-nowrap">Indent No.</p>
                      <p className="text-sm font-light">{selectedRow.indentNo}</p>
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
                  </div>
                </div>

                <div className="grid gap-4 py-4">
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
                              <SelectItem value="okey">Okey</SelectItem>
                              <SelectItem value="not okey">Not Okey</SelectItem>
                            </SelectContent>
                          </Select>
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