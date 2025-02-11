import type { Contract } from "@frontend-monorepo/http-client-lender";
import { Box, Flex, Heading, RadioCards, Text } from "@radix-ui/themes";
import { useState } from "react";
import { Col, Container, Row } from "react-bootstrap";
import { LiquidateToBitcoin } from "./liquidation/liquidate-to-bitcoin";
import { LiquidateToStablecoin } from "./liquidation/liquidate-to-stablecoin";

interface ContractDefaultedProps {
  contract: Contract;
}

enum LiquidationPreference {
  bitcoin = "0",
  stablecoin = "1",
}

export function ContractDefaulted({ contract }: ContractDefaultedProps) {
  const [selectedLiquidationPreference, setSelectedLiquidationPreference] =
    useState(LiquidationPreference.bitcoin);

  return (
    <Container fluid>
      <Heading
        className={"text-font dark:text-font-dark"}
        size={"4"}
        weight={"medium"}
      >
        Liquidate Collateral
      </Heading>
      <Row className="mt-4">
        <Col>
          <div className="d-flex flex-column">
            <p className="mt-2 text-break text-font dark:text-font-dark">
              To liquidate the collateral you will have to provide your{" "}
              <strong>password</strong>.
            </p>
          </div>
        </Col>
      </Row>
      <Row className="mt-4">
        <Col>
          <div className="d-flex flex-column">
            <Box maxWidth="600px">
              <RadioCards.Root
                value={selectedLiquidationPreference.toString()}
                columns={{ initial: "2", sm: "2" }}
                size={"3"}
                onValueChange={(new_pref) => {
                  if (
                    Object.values(LiquidationPreference).includes(
                      new_pref as LiquidationPreference,
                    )
                  ) {
                    setSelectedLiquidationPreference(
                      new_pref as LiquidationPreference,
                    );
                  }
                }}
              >
                <RadioCards.Item
                  value={LiquidationPreference.bitcoin.toString()}
                >
                  <Flex direction="column" width="100%">
                    <Text
                      className={"text-font dark:text-font-dark"}
                      size={"3"}
                      weight={"bold"}
                    >
                      Receive as bitcoin
                    </Text>
                  </Flex>
                </RadioCards.Item>
                <RadioCards.Item
                  value={LiquidationPreference.stablecoin.toString()}
                >
                  <Flex direction="column" width="100%">
                    <Text
                      className={"text-font dark:text-font-dark"}
                      size={"3"}
                      weight={"bold"}
                    >
                      Receive as {contract.loan_asset_type}
                    </Text>
                    <Text
                      className={"text-font dark:text-font-dark"}
                      size={"1"}
                      weight={"medium"}
                    ></Text>
                  </Flex>
                </RadioCards.Item>
              </RadioCards.Root>
            </Box>
          </div>
        </Col>
      </Row>

      {selectedLiquidationPreference === LiquidationPreference.bitcoin && (
        <LiquidateToBitcoin contractId={contract.id} />
      )}
      {selectedLiquidationPreference === LiquidationPreference.stablecoin && (
        <LiquidateToStablecoin
          contractId={contract.id}
          repaymentAddress={contract.loan_repayment_address}
        />
      )}
    </Container>
  );
}
