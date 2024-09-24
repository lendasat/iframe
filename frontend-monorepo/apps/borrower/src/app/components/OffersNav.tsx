import { Button, DropdownMenu, Flex, Select } from "@radix-ui/themes";
import React from "react";
import { BsSortUp } from "react-icons/bs";
import { IoAddOutline } from "react-icons/io5";
import { RiFilter2Line } from "react-icons/ri";
import LoanOffersFilter, { LoanFilter } from "../request-loan/loan-offers-filter";

interface FilterOption {
  onChange: (filter: LoanFilter) => void;
  loanFilter: LoanFilter;
}

export default function OffersNav(props: FilterOption) {
  const [value, setValue] = React.useState("Sort by");
  return (
    <>
      <div className="md:pt-4 border-b pb-2.5 flex items-center justify-between flex-wrap gap-3">
        <Select.Root
          value={value}
          onValueChange={setValue}
        >
          <Select.Trigger
            variant={"ghost"}
            className="shadow-none focus-visible:outline-none outline-none h-8 font-medium"
          >
            <Flex align={"center"} gap={"2"}>
              <BsSortUp /> {value}
            </Flex>
          </Select.Trigger>
          <Select.Content highContrast color="purple" className="font-medium">
            <Select.Item value="Amount">Amount</Select.Item>
            <Select.Item value="Duration">Duration</Select.Item>
            <Select.Item value="LTV Ratio">LTV Ratio</Select.Item>
            <Select.Item value="Interest">Interest</Select.Item>
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
                onChange={props.onChange}
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
