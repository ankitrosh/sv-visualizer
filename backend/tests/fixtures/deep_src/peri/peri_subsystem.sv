module peri_subsystem (
    input  logic clk,
    input  logic rst_n,
    input  logic irq,
    output logic [7:0] status,
    input  logic rx,
    output logic tx
);

    wire [7:0] uart_status;
    wire [7:0] spi_status;

    uart u_uart (
        .clk(clk),
        .rst_n(rst_n),
        .rx(rx),
        .tx(tx),
        .status(uart_status)
    );

    spi u_spi (
        .clk(clk),
        .rst_n(rst_n),
        .irq(irq),
        .status(spi_status)
    );

    assign status = uart_status | spi_status;

endmodule
