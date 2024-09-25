import { Button, DropdownMenu, Flex, Select } from "@radix-ui/themes";
import React from "react";
import { BsSortUp } from "react-icons/bs";
import { IoAddOutline } from "react-icons/io5";
import { RiFilter2Line } from "react-icons/ri";
import LoanOffersFilter, { LoanFilter, parseTableSortBy, TableSortBy } from "../request-loan/loan-offers-filter";

interface FilterOption {
  onLoanFilterChange: (filter: LoanFilter) => void;
  onTableSortingChange: (sortBy: TableSortBy) => void;
  loanFilter: LoanFilter;
  tableSorting: TableSortBy;
}

export default function OffersNav(props: FilterOption) {
  const updateSorting = (sortBy: string) => {
    const tableSorting = parseTableSortBy(sortBy);
    props.onTableSortingChange(tableSorting ?? TableSortBy.Amount);
  };

  return (
    <>
      <div className="md:pt-4 border-b pb-2.5 flex items-center justify-between flex-wrap gap-3">
        <Select.Root
          value={props.tableSorting}
          onValueChange={updateSorting}
        >
          <Select.Trigger
            variant={"ghost"}
            className="shadow-none focus-visible:outline-none outline-none h-8 font-medium"
          >
            <Flex align={"center"} gap={"2"}>
              <BsSortUp /> {props.tableSorting}
            </Flex>
          </Select.Trigger>
          <Select.Content highContrast color="purple" className="font-medium">
            <Select.Item value={TableSortBy.Amount}>Amount</Select.Item>
            <Select.Item value={TableSortBy.Duration}>Duration</Select.Item>
            <Select.Item value={TableSortBy.Ltv}>LTV Ratio</Select.Item>
            <Select.Item value={TableSortBy.Interest}>Interest</Select.Item>
          </Select.Content>
        </Select.Root>

        <div className="flex items-center gap-2 md:gap-3 relative">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <Button
                variant="outline"
                className="flex items-center gap-1 rounded border text-font-dark justify-center px-3 h-10 font-medium hover:border-font/50 transition-colors ease-linear duration-200 shadow-none"
              >
                <RiFilter2Line className="text-sm" />
                <span className="text-sm">Filter</span>
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content className="w-[320px] md:w-[350px] shadow border border-font/50 bg-dashboard px-3.5 rounded-2xl">
              <LoanOffersFilter
                onChange={props.onLoanFilterChange}
                loanFilter={props.loanFilter}
              />
            </DropdownMenu.Content>
          </DropdownMenu.Root>

          <button className="flex items-center gap-1 bg-btn rounded text-white px-3 h-10 font-medium hover:bg-base transition-colors ease-out duration-300 group/request">
            <IoAddOutline className="text-xl group-hover/request:rotate-180 transition-transform ease-linear duration-300" />
            <span className="text-sm">Make Request</span>
          </button>
        </div>
      </div>
    </>
  );
}
