module soc (
    input  logic clk,
    input  logic rst_n,
    output logic [7:0] status,
    input  logic       uart_rx,
    output logic       uart_tx
);

    wire [31:0] cpu_bus;
    wire [15:0] mem_addr;
    wire        irq;

    cpu u_cpu (
        .clk(clk),
        .rst_n(rst_n),
        .bus_out(cpu_bus),
        .mem_addr(mem_addr)
    );

    bus_matrix u_bus (
        .clk(clk),
        .data(cpu_bus),
        .irq(irq)
    );

    mem_top u_mem (
        .clk(clk),
        .addr(mem_addr),
        .data(cpu_bus)
    );

    peri_subsystem u_peri (
        .clk(clk),
        .rst_n(rst_n),
        .irq(irq),
        .status(status),
        .rx(uart_rx),
        .tx(uart_tx)
    );

endmodule
