import { Box, Flex, Heading } from "@radix-ui/themes";
import { ReactComponent as Pattern } from "./../../assets/credit-card-pattern.svg";
import LendasatLogo from "./../../assets/lendasat.png";
import VisaIcon from "./../../assets/visa_logo_icon.webp";
import { formatCreditCardNumber } from "./Cards";

export default function CreditCards({ cardNumber, visibility }: { cardNumber: number; visibility?: boolean }) {
  return (
    <Box className="max-h-52 h-full w-full py-5 bg-[#280f45] border border-white/5 max-w-[390px] md:max-w-[350px] rounded-2xl relative overflow-hidden flex flex-col justify-between">
      <Box className="pl-6">
        <img
          src={LendasatLogo}
          className="invert h-5 w-auto"
        />
      </Box>

      <Box>
        <Flex align={"center"} justify={"between"} className="pl-6 pr-3">
          {/* Card Owner */}
          <Box>
            <Heading weight={"medium"} className="text-white text-base tracking-wider">
              Satoshi Nakamoto
            </Heading>
          </Box>
        </Flex>
        <Flex align={"center"} justify={"between"} className="pl-6 pr-3">
          {/* Card number */}
          <Box>
            <Heading className="text-white text-lg">
              {visibility
                ? formatCreditCardNumber(cardNumber)
                : "****" + " " + cardNumber.toString().slice(-4)}
            </Heading>
          </Box>

          {/* Card type */}
          <Box className="h-6 w-auto">
            <img
              src={VisaIcon}
              className="h-full w-full object-contain object-center invert"
            />
          </Box>
        </Flex>
      </Box>
      <Pattern className="absolute object-cover object-center opacity-[2%] invert" />
    </Box>
  );
}
