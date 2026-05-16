module l2_cache (
    input  logic clk,
    input  logic [15:0] addr,
    inout  logic [31:0] data,
    output logic        hit
);

    cache_ctrl u_ctrl (
        .clk(clk),
        .addr(addr[9:0]),
        .hit(hit)
    );

    sram_bank u_sram (
        .clk(clk),
        .addr(addr[9:0]),
        .data(data)
    );

endmodule
