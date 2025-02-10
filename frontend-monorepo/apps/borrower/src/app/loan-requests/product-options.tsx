import { LoanProductOption } from "@frontend-monorepo/base-http-client";
import { useAuth } from "@frontend-monorepo/http-client-borrower";
import { Box, Grid } from "@radix-ui/themes";
import Bitrefil from "../../assets/bitrefil.png";
import Defi from "../../assets/defi.png";
import { ReactComponent as MoonCard } from "../../assets/moon_card_satoshi_nakamoto.svg";
import Sepa from "../../assets/sepa.jpg";
import { ProductOptionComponent } from "./services/product-option-component";

interface ProductSelectionProps {
  onSelect: (option: LoanProductOption | undefined) => void;
  selectedOption?: LoanProductOption;
}

export const ProductSelection = ({ onSelect, selectedOption }: ProductSelectionProps) => {
  const { enabledFeatures } = useAuth();

  return (
    <Box width="100%" className="flex justify-center">
      <Grid
        columns={{ initial: "1", md: "2", xl: "3" }}
        gap="5"
        py={{ initial: "6", md: "8" }}
      >
        {enabledFeatures.map((option, index) => {
          let component;
          switch (option) {
            case LoanProductOption.PayWithMoonDebitCard:
              component = (
                <ProductOptionComponent
                  onSelect={onSelect}
                  option={option}
                  selectedOption={selectedOption}
                  title={"Receive a Moon Visa® Card"}
                  key={index}
                  disabled={false}
                  image={<MoonCard />}
                />
              );
              break;
            case LoanProductOption.BringinBankAccount:
              component = (
                <ProductOptionComponent
                  onSelect={onSelect}
                  option={option}
                  selectedOption={selectedOption}
                  title={"To a bank account using SEPA via Bringin"}
                  key={index}
                  disabled={false}
                  image={<img src={Sepa} alt="SEPA" />}
                />
              );
              break;
            case LoanProductOption.BitrefillDebitCard:
              component = (
                <ProductOptionComponent
                  onSelect={onSelect}
                  option={option}
                  selectedOption={selectedOption}
                  title={"A debit card by Bitrefill"}
                  key={index}
                  disabled={false}
                  image={<img src={Bitrefil} alt="Bitrefil" />}
                />
              );
              break;
            case LoanProductOption.StableCoins:
              component = (
                <ProductOptionComponent
                  onSelect={onSelect}
                  option={option}
                  selectedOption={selectedOption}
                  title={"Receive stablecoins"}
                  key={index}
                  disabled={false}
                  image={<img src={Defi} alt="Defi" className="max-h-full max-w-full" />}
                />
              );
              break;
          }

          return component;
        })}
      </Grid>
    </Box>
  );
};
