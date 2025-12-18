import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { toast } from 'sonner';
import { Form, FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select';
import { ClipLoader as Loader } from 'react-spinners';
import { ClipboardList, Trash, Search } from 'lucide-react';
import { postToIssueSheet, postToSheet, uploadFile } from '@/lib/fetchers';
import type { IndentSheet } from '@/types';

import type { IssueSheet } from '@/types';
import { useSheets } from '@/context/SheetsContext';
import Heading from '../element/Heading';
import { useEffect, useState } from 'react';

export default () => {
    const { issueSheet: sheet, updateIssueSheet, masterSheet: options } = useSheets();
    const [issueSheet, setIssueSheet] = useState<IssueSheet[]>([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [searchTermGroupHead, setSearchTermGroupHead] = useState('');
    const [searchTermProductName, setSearchTermProductName] = useState('');
    const [searchTermUOM, setSearchTermUOM] = useState('');
    const [searchTermLocation, setSearchTermLocation] = useState('');

    useEffect(() => {
        setIssueSheet(sheet);
    }, [sheet]);

    const schema = z.object({
        products: z
            .array(
                z.object({
                    department: z.string().nonempty(),
                    groupHead: z.string().nonempty(),
                    productName: z.string().nonempty(),
                    quantity: z.coerce.number().gt(0, 'Must be greater than 0'),
                    uom: z.string().nonempty(),
                    specifications: z.string().optional(),
                    givenQuantity: z.coerce.number().gt(0, 'Must be greater than 0').optional(),
                    location: z.string().nonempty(), // ✅ Location is required
                })
            )
            .min(1, 'At least one product is required'),
    });

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            products: [
                {
                    uom: '',
                    productName: '',
                    specifications: '',
                    quantity: 1,
                    groupHead: '',
                    department: '',
                    location: '', // ✅ Location in default values
                },
            ],
        },
    });

    const products = form.watch('products');
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'products',
    });

    async function onSubmit(data: z.infer<typeof schema>) {
        try {
            const getNextIssueNumber = (existingIssues: Partial<IssueSheet>[]) => {
                if (!Array.isArray(existingIssues) || existingIssues.length === 0) return 'IS-0001';

                const availableNumbers = existingIssues
                    .filter((issue) => issue.issueNo && typeof issue.issueNo === 'string')
                    .map((issue) => issue.issueNo!)
                    .filter((num) => /^IS-\d+$/.test(num))
                    .map((num) => parseInt(num.split('-')[1], 10));

                if (availableNumbers.length === 0) return 'IS-0001';

                const lastIssueNumber = Math.max(...availableNumbers);
                return `IS-${String(lastIssueNumber + 1).padStart(4, '0')}`;
            };

            const nextIssueNumber = getNextIssueNumber(issueSheet || []);

            const rows: Partial<IssueSheet>[] = [];
            for (const product of data.products) {
                const row: Partial<IssueSheet> = {
                    timestamp: new Date().toISOString(),
                    issueNo: nextIssueNumber,
                    issueTo: product.specifications || '',
                    uom: product.uom,
                    groupHead: product.groupHead,
                    productName: product.productName,
                    quantity: product.quantity,
                    department: product.department,
                    location: product.location, // ✅ Location included in submission
                };

                rows.push(row);
            }

            await postToIssueSheet(rows);
            setTimeout(() => updateIssueSheet(), 1000);
            toast.success('Issue created successfully');

            form.reset({
                products: [
                    {
                        uom: '',
                        productName: '',
                        specifications: '',
                        quantity: 1,
                        groupHead: '',
                        department: '',
                        location: '', // ✅ Reset location too
                    },
                ],
            });
        } catch (error) {
            console.error('Error in onSubmit:', error);
            toast.error('Error while creating issue! Please try again');
        }
    }

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }

    // Debug: Check if location data is available
    console.log('Available locations:', options?.location);
    console.log('Form values:', form.watch());

    return (
        <div>
            <Heading heading="Store Issue" subtext="Create new Issue">
                <ClipboardList size={50} className="text-primary" />
            </Heading>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-6 p-5">
                    <div className="space-y-4">
                        {fields.map((field, index) => {
                            const groupHead = products[index]?.groupHead;
                            const department = products[index]?.department;
                            const productOptions = options?.groupHeads[groupHead] || [];

                            return (
                                <div
                                    key={field.id}
                                    className="flex flex-col gap-4 border p-4 rounded-lg"
                                >
                                    <div className="flex justify-between">
                                        <h3 className="text-md font-semibold">Product</h3>
                                    </div>
                                    <div className="grid gap-4">
                                        {/* Increased grid columns to accommodate location */}
                                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                            {/* Department Field */}
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.department`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            Department
                                                            <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger className="w-full">
                                                                    <SelectValue placeholder="Select department" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div className="flex items-center border-b px-3 pb-3">
                                                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                                    <input
                                                                        placeholder="Search departments..."
                                                                        value={searchTerm}
                                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                        className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                                    />
                                                                </div>
                                                                {(options?.departments || [])
                                                                    .filter((dep) =>
                                                                        dep.toLowerCase().includes(searchTerm.toLowerCase())
                                                                    )
                                                                    .map((dep, i) => (
                                                                        <SelectItem key={i} value={dep}>
                                                                            {dep}
                                                                        </SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />

                                            {/* Group Head Field */}
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.groupHead`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            Group Head
                                                            <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger className="w-full">
                                                                    <SelectValue placeholder="Select group head" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div className="flex items-center border-b px-3 pb-3">
                                                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                                    <input
                                                                        placeholder="Search group heads..."
                                                                        value={searchTermGroupHead}
                                                                        onChange={(e) => setSearchTermGroupHead(e.target.value)}
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                        className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                                    />
                                                                </div>
                                                                {Object.keys(options?.groupHeads || {})
                                                                    .filter((dep) =>
                                                                        dep.toLowerCase().includes(searchTermGroupHead.toLowerCase())
                                                                    )
                                                                    .map((dep, i) => (
                                                                        <SelectItem key={i} value={dep}>
                                                                            {dep}
                                                                        </SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />

                                            {/* Product Name Field */}
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.productName`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            Product Name
                                                            <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                            disabled={!groupHead}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger className="w-full">
                                                                    <SelectValue placeholder="Select product" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div className="flex items-center border-b px-3 pb-3">
                                                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                                    <input
                                                                        placeholder="Search products..."
                                                                        value={searchTermProductName}
                                                                        onChange={(e) => setSearchTermProductName(e.target.value)}
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                        className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                                    />
                                                                </div>
                                                                {productOptions
                                                                    .filter((dep) =>
                                                                        dep.toLowerCase().includes(searchTermProductName.toLowerCase())
                                                                    )
                                                                    .map((dep, i) => (
                                                                        <SelectItem key={i} value={dep}>
                                                                            {dep}
                                                                        </SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />

                                            {/* Quantity Field */}
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.quantity`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            Quantity
                                                            <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                {...field}
                                                                disabled={!groupHead}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />

                                            {/* UOM Field */}
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.uom`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            UOM
                                                            <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                            disabled={!groupHead}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger className="w-full">
                                                                    <SelectValue placeholder="Select UOM" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div className="flex items-center border-b px-3 pb-3">
                                                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                                    <input
                                                                        placeholder="Search UOM..."
                                                                        value={searchTermUOM}
                                                                        onChange={(e) => setSearchTermUOM(e.target.value)}
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                        className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                                    />
                                                                </div>
                                                                {(options?.uoms || [])
                                                                    .filter((uom) =>
                                                                        uom.toLowerCase().includes(searchTermUOM.toLowerCase())
                                                                    )
                                                                    .map((uom, i) => (
                                                                        <SelectItem key={i} value={uom}>
                                                                            {uom}
                                                                        </SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        {/* Second row for Location and other fields if needed */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* ✅ LOCATION FIELD - Now properly placed */}

{/* ✅ LOCATION FIELD - FIXED PROPERTY NAME */}
<FormField
    control={form.control}
    name={`products.${index}.location`}
    render={({ field }) => (
        <FormItem>
            <FormLabel>
                Location
                <span className="text-destructive">*</span>
            </FormLabel>
            <Select
                onValueChange={field.onChange}
                value={field.value}
            >
                <FormControl>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                </FormControl>
                <SelectContent>
                    {/* 🔍 Search Box */}
                    <div className="flex items-center border-b px-3 pb-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <input
                            placeholder="Search locations..."
                            value={searchTermLocation}
                            onChange={(e) => setSearchTermLocation(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                        />
                    </div>
                    {/* ✅ CHANGED: Use options?.locations instead of options?.location */}
                    {(options?.locations || [])
                        .filter((location) =>
                            location.toLowerCase().includes(searchTermLocation.toLowerCase())
                        )
                        .map((location, i) => (
                            <SelectItem key={i} value={location}>
                                {location}
                            </SelectItem>
                        ))}
                    {/* Fallback if no locations */}
                    {(options?.locations || []).length === 0 && (
                        <SelectItem value="no-locations" disabled>
                            No locations available
                        </SelectItem>
                    )}
                </SelectContent>
            </Select>
        </FormItem>
    )}
/>

                                            {/* Specifications Field */}
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.specifications`}
                                                render={({ field }) => (
                                                    <FormItem className="w-full">
                                                        <FormLabel>Remarks</FormLabel>
                                                        <FormControl>
                                                            <Textarea
                                                                placeholder="Enter specifications"
                                                                className="resize-y"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div>
                        <Button
                            className="w-full"
                            type="submit"
                            disabled={form.formState.isSubmitting}
                        >
                            {form.formState.isSubmitting && (
                                <Loader size={20} color="white" aria-label="Loading Spinner" />
                            )}
                            Store Issue
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
};