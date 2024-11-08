import type { UserCardDetail } from "@frontend-monorepo/http-client-borrower";
import { Box, Flex, Heading } from "@radix-ui/themes";
import { ReactComponent as Pattern } from "./../../assets/credit-card-pattern.svg";
import LendasatLogo from "./../../assets/lendasat.png";
import VisaIcon from "./../../assets/visa_logo_icon.webp";
import { formatCreditCardNumber, formatExpiryDate } from "./Cards";

interface CredtCardProps {
  card: UserCardDetail;
  visible?: boolean;
}

export default function CreditCard({ card, visible }: CredtCardProps) {
  return (
    <Box className="max-h-52 h-full w-full py-5 bg-[#280f45] border border-white/5 max-w-[390px] md:max-w-[350px] rounded-2xl relative overflow-hidden flex flex-col justify-between">
      <Box className="pl-6">
        <img
          alt={"lendasat logo"}
          src={LendasatLogo}
          className="invert h-5 w-auto"
        />
      </Box>

      <Box>
        <Flex align={"center"} justify={"between"} className="pl-6 pr-3">
          {/*Card Owner */}
          <Box>
            <Heading className="text-white text-lg">
              {visible
                ? formatCreditCardNumber(card.pan)
                : `**** **** **** ${card.pan.toString().slice(-4)}`}
            </Heading>
          </Box>
        </Flex>
        <Flex align={"center"} justify={"between"} className="pl-6 pr-3">
          {/* Card number */}
          <Box>
            <Heading className="text-white text-sm">
              {visible
                ? formatExpiryDate(card.expiration)
                : "**/**"}
            </Heading>
          </Box>

          <Box>
            <Heading className="text-white text-sm">
              {visible
                ? card.cvv
                : "***"}
            </Heading>
          </Box>

          {/* Card type */}
          <Box className="h-6 w-auto">
            <img
              alt={"visa logo"}
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
