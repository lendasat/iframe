import { Box, Button, Flex, Grid, Heading, Separator, Text } from "@radix-ui/themes";
import React from "react";
import { IconType } from "react-icons";
import { BsBank, BsTicketPerforatedFill } from "react-icons/bs";
import { IoWalletOutline } from "react-icons/io5";
import { RiCustomerService2Fill } from "react-icons/ri";
import { Link } from "react-router-dom";
import SecurityImg from "../../assets/security-icon.png";
import DashboardTransaction from "./DashboardTransaction";
import LoanCarousel from "./LoanCarousel";

function DashBoard() {
  const { innerHeight } = window;
  return (
    // <Container className="">
    //   <Row className="justify-content-center">
    //     {
    //       /* <Col md={6} className="d-flex flex-column align-items-center">
    //       <FullLogoWhiteBg />
    //       <h1 className="mt-4">Welcome to Lendasat</h1>
    //       <p className="lead mt-3">
    //         Lendasat is your gateway to borrow against your Bitcoin in a non-custodial and peer-2-peer way.
    //       </p>
    //       <div className="mt-4">
    //         <Button variant="primary" href="/request-loan" className="me-3">Get a Loan</Button>
    //         <Button variant="secondary" href="https://whitepaper.lendasat.com/lendasat-whitepaper.pdf" target="_blank">
    //           Learn How It Works
    //         </Button>
    //       </div>
    //       <Row className="justify-content-center mt-5">
    //         <Col md={6} className="d-flex justify-content-around">
    //           <a href="https://x.com/lendasat" target="_blank" rel="noopener noreferrer" className="mx-3">
    //             <FaXTwitter size={"30"} color={"black"} />
    //           </a>
    //           <a href="https://lendasat.com" target="_blank" rel="noopener noreferrer" className="mx-3">
    //             <FaGlobe size={"30"} color={"black"} />
    //           </a>
    //           <a href="https://github.com/lendasat" target="_blank" rel="noopener noreferrer" className="mx-3">
    //             <FaGithub size={"30"} color={"black"} />
    //           </a>
    //           <a
    //             href="https://discord.gg/kyxqWFKMCF"
    //             target="_blank"
    //             rel="noopener noreferrer"
    //             className="mx-3"
    //           >
    //             <FaDiscord size={"30"} color={"black"} />
    //           </a>
    //         </Col>
    //       </Row>
    //     </Col> */
    //     }
    //   </Row>
    //   <DashHeader label={"Dashboard"} />

    //   <Button asChild>
    //     <Link to={"/logout"}>Logout</Link>
    //   </Button>
    // </Container>

    <Box
      className="flex flex-col overflow-y-scroll p-4 md:p-8"
      height={innerHeight - 120 + "px"}
    >
      <Grid className="md:grid-cols-2 md:grid-rows-2 xl:grid-cols-[minmax(350px,_1fr)_minmax(450px,_1fr)_minmax(300px,_1fr)] gap-5">
        <Box className="md:bg-gradient-to-b from-white to-white/10 backdrop-blur rounded-2xl p-5 md:row-span-2">
          <Text as="p" weight={"medium"} className="text-font" size={"3"}>Loan Secured</Text>
          {/* Total Loan Received */}
          <Heading size={"8"} mt={"3"} className="text-font-dark">$756,809.32</Heading>

          <Box className="grid grid-cols-2 gap-3 mt-8">
            <Box className="border border-font/10 rounded-xl py-2 px-3">
              {/* Total number of loans received */}
              <Heading size={"6"}>7</Heading>
              <Text size={"2"} weight={"medium"} className="text-font/70">Loans in Total</Text>
            </Box>

            <Box className="border border-font/10 rounded-xl py-2 px-3">
              {/* Total number of loans not repaid/closed */}
              <Heading size={"6"}>2</Heading>
              <Text size={"2"} weight={"medium"} className="text-font/70">Active Loan</Text>
            </Box>
          </Box>
          <Separator size={"4"} my={"5"} className="bg-font/10" />

          {/* Quick action buttons */}
          <Text as="p" weight={"medium"} className="text-font" size={"3"}>Quick Actions</Text>
          <Box className="grid grid-cols-2 gap-y-5 gap-x-8 px-3 mt-5">
            <QuickLinks
              Icon={BsTicketPerforatedFill}
              target="/request"
              iconStyle="bg-purple-100"
              label="Request new Loan"
            />

            <QuickLinks
              Icon={IoWalletOutline}
              target="/my-contracts"
              iconStyle="bg-green-100"
              label="My Loans"
            />
            <QuickLinks
              Icon={BsBank}
              target="/request-loan"
              iconStyle="bg-pink-100"
              label="Available offers"
            />
            <QuickLinks
              Icon={RiCustomerService2Fill}
              target="https://lendasat.notion.site/"
              iconStyle="bg-gray-100"
              label="Help Center"
            />
          </Box>
        </Box>

        <Box className="p-5 rounded-2xl xl:bg-white">
          <LoanCarousel />
        </Box>
        <Box className="bg-white rounded-2xl p-5 min-h-60 flex flex-col items-center justify-center">
          <img src={SecurityImg} alt="credit card" className="max-w-32" />
          <Text size={"2"} className="text-font/60 max-w-[250px] text-center">
            Lendasat is your gateway to borrow against your Bitcoin in a non-custodial and peer-2-peer way.
          </Text>
        </Box>

        <Box className="bg-gradient-to-b from-white to-white/10 backdrop-blur rounded-2xl p-5 md:col-span-2 min-h-72 h-full">
          <Flex align={"center"} justify={"between"} pr={"3"} pb={"3"}>
            <Text as="p" weight={"medium"} className="text-font" size={"3"}>Transaction</Text>
            <Button variant="ghost" className="hover:bg-transparent text-purple-800 hover:text-font-dark font-medium">
              <Link to={"/history"}>
                View All
              </Link>
            </Button>
          </Flex>
          <DashboardTransaction />
        </Box>
      </Grid>
    </Box>
  );
}

export default DashBoard;

const QuickLinks = ({ label, Icon, iconStyle, target }: {
  Icon: IconType;
  label: string;
  iconStyle: string;
  target: string;
}) => {
  return (
    <Button
      asChild
      variant="ghost"
      className="min-h-40 border border-font/10 flex flex-col gap-2 text-font rounded-2xl"
    >
      <Link to={target}>
        <Box className={`h-14 w-14 rounded-full place-items-center ${iconStyle} flex justify-center`}>
          <Icon size={"20"} />
        </Box>
        <Text size={"2"} weight={"medium"}>{label}</Text>
      </Link>
    </Button>
  );
};
