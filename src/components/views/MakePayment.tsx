import { useSheets } from '@/context/SheetsContext';
import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
import { DollarSign } from 'lucide-react';
import Heading from '../element/Heading';
import { useAuth } from '@/context/AuthContext';

// Use the actual StoreInSheet type from your context
interface StoreInSheet {
  indentNo?: string;
  billNo?: string;
  billAmount?: number;
  advanceAmountIfAny?: string; // This is string in your actual data
}

interface MakePaymentData {
  indentNo: string;
  billNo: string;
  vendorName: string;
  productName: string;
  qty: number;
  billAmount: number;
  advanceAmount: number;
  paymentType: string;
  firmNameMatch: string;
  makePaymentLink: string;
  planned7Date: string;
}

interface IndentSheetItem {
  firmNameMatch?: string;
  indentNumber?: string;
  planned7?: any;
  makePaymentLink?: any;
  approvedVendorName?: string;
  vendorName1?: string;
  productName?: string;
  quantity?: number;
  paymentType?: string;
}

interface PaymentHistoryItem {
  uniqueNumber: string;
  timestamp: string;
}

// Add this helper function before the component
const formatPlannedDate = (dateString: string) => {
  if (!dateString || dateString.trim() === '') return '';
  try {
    // If it's already in dd/mm/yyyy format, return as is
    if (dateString.includes('/')) {
      return dateString;
    }
    
    // If it's a date string that can be parsed
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

export default function MakePayment() {
  const { indentSheet, indentLoading, storeInSheet, paymentHistorySheet } = useSheets();
  const [tableData, setTableData] = useState<MakePaymentData[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!indentSheet || !storeInSheet || !user || !paymentHistorySheet) return;

    // Lookup map: indent number (uniqueNumber) -> payment timestamp
    const actualMap = new Map<string, string>(
      (paymentHistorySheet as PaymentHistoryItem[]).map((item: PaymentHistoryItem) => [
        item.uniqueNumber,
        item.timestamp
      ])
    );

    // Filter by firm
    const filteredByFirm = (indentSheet as IndentSheetItem[]).filter((sheet: IndentSheetItem) =>
      user.firmNameMatch?.toLowerCase() === 'all' ||
      sheet.firmNameMatch === user.firmNameMatch
    );

    // Map of STORE IN data by indent number - use StoreInSheet type
    const storeInMap = new Map(
      (storeInSheet as StoreInSheet[]).map((item: StoreInSheet) => [
        item.indentNo,
        {
          billNo: item.billNo || '',
          billAmount: item.billAmount || 0,
          // Convert string to number for advanceAmountIfAny
          advanceAmount: Number(item.advanceAmountIfAny) || 0,
        }
      ])
    );

    setTableData(
      filteredByFirm
        .map((sheet: IndentSheetItem) => {
          const actual7Value = actualMap.get(sheet.indentNumber || '') || '';
          return {
            ...sheet,
            actual7: actual7Value
          };
        })
        .filter((sheet: any) => {
          const planned7IsPresent =
            sheet.planned7 !== undefined &&
            sheet.planned7 !== null &&
            sheet.planned7.toString().trim() !== '';
          const actual7IsAbsent =
            sheet.actual7 === undefined ||
            sheet.actual7 === null ||
            sheet.actual7.toString().trim() === '';
          return planned7IsPresent && actual7IsAbsent;
        })
        .map((sheet: any) => {
          const billData = storeInMap.get(sheet.indentNumber) || {
            billNo: '',
            billAmount: 0,
            advanceAmount: 0,
          };
          return {
            indentNo: sheet.indentNumber || '',
            billNo: billData.billNo,
            vendorName: sheet.approvedVendorName || sheet.vendorName1 || '',
            productName: sheet.productName || '',
            qty: sheet.quantity || 0,
            billAmount: billData.billAmount,
            advanceAmount: billData.advanceAmount,
            paymentType: sheet.paymentType || '',
            firmNameMatch: sheet.firmNameMatch || '',
            makePaymentLink: sheet.makePaymentLink?.toString() || '',
            planned7Date: sheet.planned7 || '',
          };
        })
        .sort((a, b) => b.indentNo.localeCompare(a.indentNo))
    );
  }, [indentSheet, storeInSheet, paymentHistorySheet, user]);

  const handleMakePayment = (item: MakePaymentData) => {
    if (item.makePaymentLink) {
      window.open(item.makePaymentLink, '_blank');
    } else {
      console.warn('No payment link available for indent:', item.indentNo);
    }
  };

  const columns: ColumnDef<MakePaymentData>[] = [
    {
      header: 'Action',
      cell: ({ row }: { row: Row<MakePaymentData> }) => {
        const item = row.original;
        return (
          <Button
            variant="outline"
            onClick={() => handleMakePayment(item)}
            disabled={!item.makePaymentLink}
          >
            Make Payment
          </Button>
        );
      },
    },
    { accessorKey: 'indentNo', header: 'Indent No.' },
    { accessorKey: 'firmNameMatch', header: 'Firm Name' },
    { accessorKey: 'billNo', header: 'Bill No.' },
    { accessorKey: 'vendorName', header: 'Vendor Name' },
    { accessorKey: 'productName', header: 'Product Name' },
    { accessorKey: 'qty', header: 'Qty' },
    {
      accessorKey: 'billAmount',
      header: 'Bill Amount',
      cell: ({ getValue }) => `₹${getValue() as number}`,
    },
    {
      accessorKey: 'advanceAmount',
      header: 'Advance Amount',
      cell: ({ getValue }) => `₹${getValue() as number}`,
    },
    { accessorKey: 'paymentType', header: 'Payment Type' },
    { 
      accessorKey: 'planned7Date', 
      header: 'Planned Date',
      cell: ({ row }) => formatPlannedDate(row.original.planned7Date)
    },
  ];

  return (
    <div>
      <Heading heading="Make Payment" subtext="Process advance payments">
        <DollarSign size={50} className="text-green-600" />
      </Heading>
      <DataTable
        data={tableData}
        columns={columns}
        searchFields={['indentNo', 'billNo', 'vendorName', 'productName', 'firmNameMatch']}
        dataLoading={indentLoading}
      />
    </div>
  );
}