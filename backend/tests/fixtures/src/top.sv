module top (
    input  logic clk,
    input  logic rst_n,
    output logic [7:0] gpio_out,
    input  logic rx,
    output logic tx
);

    wire [31:0] data_bus;
    wire [15:0] addr_bus;

    cpu u_cpu (
        .clk(clk),
        .rst_n(rst_n),
        .data(data_bus),
        .addr(addr_bus)
    );

    mem_ctrl u_mem (
        .clk(clk),
        .addr(addr_bus),
        .data(data_bus)
    );

    uart u_uart (
        .clk(clk),
        .rx(rx),
        .tx(tx)
    );

    gpio u_gpio (
        .clk(clk),
        .gpio_out(gpio_out)
    );

endmodule
