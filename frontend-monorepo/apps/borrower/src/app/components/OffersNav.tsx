import { Box, Button, Flex, Select, Separator, Text } from "@radix-ui/themes";
import React from "react";
import Offcanvas from "react-bootstrap/Offcanvas";
import { BsSortUp } from "react-icons/bs";
import { IoAddOutline } from "react-icons/io5";
import { LiaTimesSolid } from "react-icons/lia";
import { RiFilter2Line } from "react-icons/ri";
import { Link } from "react-router-dom";
import LoanOffersFilter, { LoanFilter, parseTableSortBy, TableSortBy } from "../request-loan/loan-offers-filter";

interface FilterOption {
  onLoanFilterChange: (filter: LoanFilter) => void;
  onTableSortingChange: (sortBy: TableSortBy) => void;
  loanFilter: LoanFilter;
  tableSorting: TableSortBy;
}

export default function OffersNav(props: FilterOption) {
  const [offCanvas, setOffCanvas] = React.useState<boolean>(false);
  const updateSorting = (sortBy: string) => {
    const tableSorting = parseTableSortBy(sortBy);
    props.onTableSortingChange(tableSorting ?? TableSortBy.Amount);
  };

  return (
    <Box className="px-6 md:px-8">
      <Flex align={"center"} justify={"between"}>
        <Box>
          <Button
            variant="outline"
            onClick={() => setOffCanvas(!offCanvas)}
            className="flex items-center gap-1 rounded border text-font-dark justify-center font-medium hover:bg-purple-800/5 transition-colors ease-linear duration-200 shadow-none"
          >
            <RiFilter2Line className="text-sm" />
            <Text size={"1"} className="text-black font-semibold">
              Filter
            </Text>
          </Button>

          <Offcanvas
            show={offCanvas}
            onHide={() => setOffCanvas(false)}
            scroll={true}
            placement="end"
            backdrop={false}
            className="max-w-80 pt-5 z-30"
          >
            <Box className="px-4 pb-4 flex items-center justify-between">
              <Text className="text-lg font-semibold">
                Filter
              </Text>
              <LiaTimesSolid onClick={() => setOffCanvas(false)} />
            </Box>
            <Separator size="4" />
            <LoanOffersFilter
              onChange={props.onLoanFilterChange}
              loanFilter={props.loanFilter}
            />
          </Offcanvas>
        </Box>
        <Box>
          <Button
            asChild
            className="flex items-center gap-1 rounded bg-purple-800/10 transition-colors ease-out duration-300 group/request"
          >
            <Link to={"/custom-request"}>
              <IoAddOutline className="text-xl group-hover/request:rotate-180 transition-transform ease-linear text-base duration-300" />
              <Text size={"1"} className="text-purple-800 font-semibold">
                Customize a Request
              </Text>
            </Link>
          </Button>
        </Box>
      </Flex>
    </Box>
  );
}
